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

class SendMessageDto {
  @IsString() roomCode: string;
  @IsString() encryptedPayload: string; // bytes cifrados en base64
  @IsString() senderAlias: string;
  @IsOptional() @IsNumber() burnAfter?: number; // segundos, opcional
}

class KeyExchangeDto {
  @IsString() roomCode: string;
  @IsString() targetSocketId: string;  // a quién va dirigida la clave
  @IsString() wrappedKey: string;      // clave cifrada con ECDH
  @IsString() publicKey: string;       // clave pública del emisor
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class MessageGateway {
  @WebSocketServer()
  server: Server;

  // ── Relay de mensajes cifrados ────────────────────────
  // El servidor NO descifra nada — solo retransmite
  @SubscribeMessage('message:send')
  onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

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

  // ── Intercambio de claves ECDH ────────────────────────
  // Permite que los clientes compartan la clave de sala
  // sin que el servidor la vea en texto plano
  @SubscribeMessage('key:exchange')
  onKeyExchange(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: KeyExchangeDto,
  ) {
    // Retransmitir la clave cifrada directamente al destinatario
    this.server.to(dto.targetSocketId).emit('key:receive', {
      fromSocketId: client.id,
      wrappedKey: dto.wrappedKey,   // clave de sala cifrada con ECDH
      publicKey: dto.publicKey,      // clave pública del emisor
    });
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
}