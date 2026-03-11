// src/modules/message/presentation/message.gateway.ts
// El servidor SOLO retransmite bytes cifrados
// No puede leer el contenido — zero knowledge

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Inject } from '@nestjs/common';
import { ROOM_REPOSITORY } from '../../room/domain/room.repository';
import type { RoomRepository } from '../../room/domain/room.repository';

class SendMessageDto {
  @IsString() roomCode: string;
  @IsString() encryptedPayload: string; // bytes cifrados en base64
  @IsString() senderAlias: string;
  @IsOptional() @IsNumber() burnAfter?: number; // segundos, opcional
}

class KeyExchangeDto {
  @IsString() roomCode: string;
  @IsOptional() @IsString() targetSocketId?: string;  // Opcional para broadcast
  @IsString() publicKey: string;       // clave pública del emisor
  @IsOptional() @IsString() wrappedKey?: string;    // room key encriptada (solo creador)
  @IsOptional() @IsString() participantAlias?: string; // Alias del participante
}

class RoomKeyShareDto {
  @IsString() roomCode: string;
  @IsString() targetParticipant: string;  // Alias del destinatario
  @IsString() wrappedRoomKey: string;    // Room key encriptada con ECDH
  @IsString() senderAlias: string;       // Quien envía (debe ser creador)
}

class GetMessagesDto {
  @IsString() roomCode: string;
}

class SecurityAlertDto {
  @IsString() type: string;
  @IsOptional() data?: any;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class MessageGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly roomRepository: RoomRepository,
  ) {}

  private isValidPublicKey(publicKey: string): boolean {
    try {
      const buffer = Buffer.from(publicKey, 'base64');
      return buffer.length === 65; // P256 key sizes
    } catch {
      return false;
    }
  }

  private keyExchangeAttempts = new Map<string, number>();

  // ── Relay de mensajes cifrados ────────────────────────
  // El servidor NO descifra nada — solo retransmite
  @SubscribeMessage('message:send')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Guardar mensaje cifrado en Redis con TTL
    const messageData = {
      id: messageId,
      roomCode: dto.roomCode,
      encryptedPayload: dto.encryptedPayload,
      senderAlias: dto.senderAlias,
      sentAt: new Date().toISOString(),
      burnAfter: dto.burnAfter ?? null,
    };

    try {
      await this.roomRepository.saveMessage(dto.roomCode, messageId, messageData, dto.burnAfter || 3600);
      console.log(`💾 [MessageGateway] Mensaje guardado: ${messageId} en sala ${dto.roomCode}`);
    } catch (error) {
      console.error(`❌ [MessageGateway] Error guardando mensaje:`, error);
    }

    // Retransmitir a TODOS en la sala excepto al emisor
    client.to(dto.roomCode).emit('message:receive', {
      id: messageId,
      encryptedPayload: dto.encryptedPayload, // bytes cifrados, ilegibles
      senderAlias: dto.senderAlias,
      sentAt: new Date().toISOString(),
      burnAfter: dto.burnAfter ?? null,
    });

    // Confirmar al emisor que se entregó
    client.emit('message:sent', {
      id: messageId,
      sentAt: new Date().toISOString(),
    });
  }

  // ── Obtener historial de mensajes ─────────────────────
  @SubscribeMessage('room:getMessages')
  async onGetMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: GetMessagesDto,
  ) {
    console.log(`📜 [MessageGateway] Solicitando historial para sala: ${dto.roomCode}`);
    
    try {
      const messages = await this.roomRepository.getRoomMessages(dto.roomCode);
      console.log(`📊 [MessageGateway] Enviando ${messages.length} mensajes`);
      
      client.emit('room:messages', {
        roomCode: dto.roomCode,
        messages: messages,
        count: messages.length,
      });
    } catch (error) {
      console.error(`❌ [MessageGateway] Error obteniendo mensajes:`, error);
      client.emit('error', { 
        code: 'HISTORY_ERROR', 
        message: 'Error obteniendo historial de mensajes' 
      });
    }
  }

  // ── Intercambio de claves ECDH (Sala Dinámica) ────────
  // Soporta broadcast de claves públicas para salas 2+ personas
  @SubscribeMessage('key:exchange')
  async onKeyExchange(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: KeyExchangeDto,
  ) {
    try {
      console.log(`🔑 [MessageGateway] INICIO key:exchange`);
      console.log(`📋 [MessageGateway] DTO recibido:`, {
        roomCode: dto.roomCode,
        targetSocketId: dto.targetSocketId || 'BROADCAST',
        participantAlias: dto.participantAlias,
        publicKeyLength: dto.publicKey?.length || 0,
        hasWrappedKey: !!dto.wrappedKey
      });

      // Validar formato de clave pública
      if (!this.isValidPublicKey(dto.publicKey)) {
        console.log(`❌ [MessageGateway] Clave pública inválida - formato incorrecto`);
        return client.emit('error', { 
          code: 'INVALID_PUBLIC_KEY',
          message: 'Public key format is invalid' 
        });
      }

      console.log(`✅ [MessageGateway] Clave pública válida - formato P256 correcto`);

      // Rate limiting
      const attempts = this.keyExchangeAttempts.get(client.id) || 0;
      if (attempts > 5) {
        console.log(`🚫 [MessageGateway] RATE LIMIT EXCEEDED - Cliente ${client.id}: ${attempts} intentos`);
        return client.emit('error', { 
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many key exchange attempts' 
        });
      }
      this.keyExchangeAttempts.set(client.id, attempts + 1);
      console.log(`📊 [MessageGateway] Rate limit - Cliente ${client.id}: ${attempts + 1}/5 intentos`);

      // Validar que emisor esté en la sala
      const room = await this.roomRepository.findByCode(dto.roomCode);
      const emitterInRoom = room?.participants.some(p => p.id === client.id);
      
      if (!emitterInRoom) {
        console.log(`❌ [MessageGateway] Emisor no está en la sala ${dto.roomCode}`);
        return client.emit('error', { 
          code: 'PARTICIPANT_NOT_IN_ROOM',
          message: 'You must be in room to exchange keys' 
        });
      }

      console.log(`✅ [MessageGateway] Emisor ${client.id} confirmado en sala ${dto.roomCode}`);
      console.log(`👥 [MessageGateway] Participantes en sala: ${room?.participantCount || 0}`);

      // ✅ Emisor confirmado en sala
// ← AGREGAR AQUÍ: persistir publicKey en el participante
      const participant = room?.participants.find(p => p.id === client.id);
      if (participant && dto.publicKey) {
        participant.publicKey = dto.publicKey;
        await this.roomRepository.savePreservingTTL(room!);
        console.log(`💾 [MessageGateway] publicKey guardada para ${client.id} en sala ${dto.roomCode}`);
      }

      // Broadcast a todos en la sala (incluyendo nuevos participantes)
      const roomCode = dto.roomCode;
      
      // Formato compatible con iOS: {roomCode, publicKey, participantAlias}
      const keyExchangeData = {
        roomCode: roomCode,
        publicKey: dto.publicKey,
        participantAlias: dto.participantAlias || 'Unknown'
      };

      console.log(`📡 [MessageGateway] Preparando envío de clave pública (formato iOS):`, {
        roomCode: keyExchangeData.roomCode,
        participantAlias: keyExchangeData.participantAlias,
        publicKeyLength: keyExchangeData.publicKey?.length || 0,
        isBroadcast: !dto.targetSocketId
      });

      // Si hay target específico, enviar solo a ese
      if (dto.targetSocketId) {
        console.log(`🎯 [MessageGateway] Enviando clave pública a target específico: ${dto.targetSocketId}`);
        this.server.to(dto.targetSocketId).emit('key:receive', keyExchangeData);
      } else {
        // Broadcast a todos los demás en la sala
        console.log(`📢 [MessageGateway] Enviando clave pública en BROADCAST a sala ${roomCode}`);
        client.to(roomCode).emit('key:receive', keyExchangeData);
      }

      console.log(`✅ [MessageGateway] Clave pública enviada exitosamente`);

      // Resetear rate limit después de 1 minuto
      setTimeout(() => {
        this.keyExchangeAttempts.delete(client.id);
        console.log(`🔄 [MessageGateway] Rate limit reseteado para cliente ${client.id}`);
      }, 60000);

    } catch (error) {
      console.error(`❌ [MessageGateway] Error en key exchange:`, error);
      client.emit('error', { 
        code: 'KEY_EXCHANGE_ERROR',
        message: 'Failed to process key exchange' 
      });
    }
  }

  // ── Distribución de Room Key (Solo Creador) ────────
  // Permite al creador compartir room key encriptada con participantes
  @SubscribeMessage('room:key:share')
  async onRoomKeyShare(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: RoomKeyShareDto,
  ) {
    try {
      console.log(`🔐 [MessageGateway] INICIO room:key:share`);
      console.log(`📋 [MessageGateway] DTO recibido:`, {
        roomCode: dto.roomCode,
        targetParticipant: dto.targetParticipant,
        wrappedRoomKeyLength: dto.wrappedRoomKey?.length || 0,
        senderAlias: dto.senderAlias
      });

      // Validar que el emisor esté en la sala
      const room = await this.roomRepository.findByCode(dto.roomCode);
      const emitterInRoom = room?.participants.some(p => p.id === client.id);
      
      if (!emitterInRoom) {
        console.log(`❌ [MessageGateway] Emisor no está en la sala ${dto.roomCode}`);
        return client.emit('error', { 
          code: 'PARTICIPANT_NOT_IN_ROOM',
          message: 'You must be in room to share keys' 
        });
      }

      console.log(`✅ [MessageGateway] Emisor ${client.id} confirmado en sala ${dto.roomCode}`);

      // Validar que el emisor sea el creador
      const emitter = room?.participants.find(p => p.id === client.id);
      if (!emitter?.isCreator) {
        console.log(`🚫 [MessageGateway] Emisor ${client.id} NO es creador de la sala ${dto.roomCode}`);
        return client.emit('error', { 
          code: 'ONLY_CREATOR_CAN_SHARE',
          message: 'Only room creator can share room keys' 
        });
      }

      console.log(`✅ [MessageGateway] Emisor ${client.id} confirmado como CREADOR de la sala`);

      // Validar que el destinatario esté en la sala
      const targetParticipant = room?.participants.find(p => p.id === dto.targetParticipant);
      if (!targetParticipant) {
        console.log(`❌ [MessageGateway] Destinatario ${dto.targetParticipant} no encontrado en sala ${dto.roomCode}`);
        return client.emit('error', { 
          code: 'TARGET_NOT_IN_ROOM',
          message: 'Target participant not found in room' 
        });
      }

      console.log(`✅ [MessageGateway] Destinatario ${dto.targetParticipant} encontrado con socket ID: ${targetParticipant.id}`);

      // Enviar room key encriptada solo al destinatario específico
      const roomKeyData = {
        roomCode: dto.roomCode,
        wrappedRoomKey: dto.wrappedRoomKey,
        senderAlias: dto.senderAlias,
        timestamp: Date.now()
      };

      console.log(`📡 [MessageGateway] Enviando room key encriptada:`, {
        roomCode: roomKeyData.roomCode,
        targetSocketId: targetParticipant.id,
        targetAlias: dto.targetParticipant,
        senderAlias: roomKeyData.senderAlias,
        wrappedKeySize: dto.wrappedRoomKey.length
      });

      this.server.to(targetParticipant.id).emit('room:key:receive', roomKeyData);

      console.log(`✅ [MessageGateway] Room key compartida exitosamente: ${dto.senderAlias} → ${dto.targetParticipant}`);

    } catch (error) {
      console.error(`❌ [MessageGateway] Error compartiendo room key:`, error);
      client.emit('error', { 
        code: 'ROOM_KEY_SHARE_ERROR',
        message: 'Failed to share room key' 
      });
    }
  }

  // ── Typing indicators ─────────────────────────────────
  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; alias: string },
  ) {
    client.to(data.roomCode).emit('typing:start', { alias: data.alias });
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; alias: string },
  ) {
    client.to(data.roomCode).emit('typing:stop', { alias: data.alias });
  }

  // ── Alertas de Seguridad ────────────────────────────────
  @SubscribeMessage('security:alert')
  async onSecurityAlert(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SecurityAlertDto,
  ) {
    try {
      console.log(`🚨 [MessageGateway] INICIO security:alert`);
      console.log(`📋 [MessageGateway] DTO recibido:`, {
        type: dto.type,
        hasData: !!dto.data,
        clientSocketId: client.id
      });

      // Validar que el cliente esté en alguna sala
      const roomCode = dto.data?.roomCode;
      if (!roomCode) {
        console.log(`❌ [MessageGateway] Alerta sin roomCode - rechazando`);
        return client.emit('error', { 
          code: 'MISSING_ROOM_CODE',
          message: 'Security alert must include room code' 
        });
      }

      console.log(`🔍 [MessageGateway] Verificando sala ${roomCode} para alerta de seguridad`);

      const room = await this.roomRepository.findByCode(roomCode);
      const clientInRoom = room?.participants.some(p => p.id === client.id);
      
      if (!clientInRoom) {
        console.log(`❌ [MessageGateway] Cliente ${client.id} no está en sala ${roomCode}`);
        return client.emit('error', { 
          code: 'NOT_IN_ROOM',
          message: 'You must be in room to send security alerts' 
        });
      }

      console.log(`✅ [MessageGateway] Cliente ${client.id} confirmado en sala ${roomCode}`);
      console.log(`👥 [MessageGateway] Enviando alerta a ${room?.participantCount || 0} participantes`);

      // Broadcast a todos los participantes de la sala
      const alertData = {
        type: `participant_${dto.type}`,
        participantSocketId: client.id,
        roomCode: roomCode,
        timestamp: Date.now(),
        ...dto.data
      };

      console.log(`🚨 [MessageGateway] Enviando alerta de seguridad:`, {
        alertType: alertData.type,
        participantSocketId: alertData.participantSocketId,
        roomCode: alertData.roomCode,
        participantCount: room?.participantCount || 0
      });

      this.server.to(roomCode).emit('security:alert', alertData);

      console.log(`✅ [MessageGateway] Alerta de seguridad enviada exitosamente`);

    } catch (error) {
      console.error(`❌ [MessageGateway] Error en security alert:`, error);
      client.emit('error', { 
        code: 'SECURITY_ALERT_ERROR',
        message: 'Failed to process security alert' 
      });
    }
  }
}