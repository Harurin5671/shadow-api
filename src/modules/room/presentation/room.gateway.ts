// src/modules/room/presentation/room.gateway.ts
// Gateway = controlador de Socket.IO en NestJS
// Equivalente a un @Controller pero para WebSockets

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { IsString, IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';
import { CreateRoomUseCase } from '../application/create-room.usecase';
import { JoinRoomUseCase } from '../application/join-room.usecase';
import type { DestructionReason } from '../application/destroy-room.usecase';
import { DestroyRoomUseCase } from '../application/destroy-room.usecase';
import type { RoomRepository } from '../domain/room.repository';
import { ROOM_REPOSITORY } from '../domain/room.repository';
import { Inject } from '@nestjs/common';
import { DomainError } from '../../../core/domain/errors/domain.error';

// DTOs — validan los datos que llegan del cliente
class CreateRoomDto {
  @IsString() alias: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsInt() @Min(2) @Max(20) maxParticipants?: number;
  @IsOptional() @IsInt() deadManSwitchInterval?: number;
  @IsOptional() @IsInt() defaultBurnAfter?: number;
}

class JoinRoomDto {
  @IsString() roomCode: string;
  @IsString() alias: string;
  @IsBoolean() isGhost: boolean;
  @IsOptional() @IsString() password?: string;
}

class DestroyRoomDto {
  @IsString() roomCode: string;
  @IsString() reason: DestructionReason;
}

@WebSocketGateway({
  cors: { origin: '*' }, // en produccion cambiar a tu dominio
  namespace: '/',
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly createRoomUseCase: CreateRoomUseCase,
    private readonly joinRoomUseCase: JoinRoomUseCase,
    private readonly destroyRoomUseCase: DestroyRoomUseCase,
    @Inject(ROOM_REPOSITORY)
    private readonly roomRepository: RoomRepository,
  ) {}

  // ── Conexion / Desconexion ────────────────────────────

  handleConnection(client: Socket) {
    console.log(`🔌 Cliente conectado: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`🔌 Cliente desconectado: ${client.id}`);

    // Buscar en qué sala estaba y removerlo
    const roomCode = client.data.roomCode as string | undefined;
    if (!roomCode) return;

    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) return;

    const removed = room.removeParticipant(client.id);
    if (!removed) return;

    // Si era el creador y queda alguien → destruir sala
    if (removed.isCreator && room.participants.length > 0) {
      await this.destroyRoomUseCase.execute({
        roomCode,
        reason: 'creatorLeft',
      });
      this.server.to(roomCode).emit('room:destroyed', {
        reason: 'creatorLeft',
        destroyedAt: new Date().toISOString(),
      });
      return;
    }

    // Si no quedan participantes → destruir sala
    if (room.participants.length === 0) {
      await this.roomRepository.delete(roomCode);
      return;
    }

    // Notificar al resto que salió
    await this.roomRepository.save(room);
    this.server.to(roomCode).emit('participant:left', {
      alias: removed.alias,
      participantCount: room.participantCount,
    });
  }

  // ── Eventos del cliente ───────────────────────────────

  @SubscribeMessage('room:getMyRooms')
  async onGetMyRooms(
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const rooms = await this.roomRepository.findByParticipant(client.id);
      
      const roomsInfo = await Promise.all(rooms.map(async room => ({
        code: room.code,
        participantCount: room.participantCount,
        settings: room.settings,
        createdAt: room.createdAt,
        myRole: room.participants.find(p => p.id === client.id)?.isCreator ? 'creator' : 'participant',
        isGhost: room.participants.find(p => p.id === client.id)?.isGhost ?? false,
        expiresInSeconds: await this.roomRepository.getTTL(room.code),
      })));

      client.emit('room:myRooms', {
        rooms: roomsInfo,
        count: roomsInfo.length,
      });
      
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('room:create')
  async onCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateRoomDto,
  ) {
    try {
      const { room, code } = await this.createRoomUseCase.execute({
        creatorSocketId: client.id,
        creatorAlias: dto.alias,
        settings: {
          maxParticipants: dto.maxParticipants,
          password: dto.password,
          deadManSwitchInterval: dto.deadManSwitchInterval,
          defaultBurnAfter: dto.defaultBurnAfter,
        },
      });

      // Unir al socket a la sala de Socket.IO
      await client.join(code);
      client.data.roomCode = code;
      const ttl = await this.roomRepository.getTTL(code);

      // Confirmar al creador
      client.emit('room:created', {
        code,
        socketId: client.id,
        participantCount: room.participantCount,
        settings: room.settings,
        createdAt: room.createdAt,
        expiresInSeconds: ttl,
      });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('room:join')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
  ) {
    try {
      const { room } = await this.joinRoomUseCase.execute({
        roomCode: dto.roomCode,
        socketId: client.id,
        alias: dto.alias,
        isGhost: dto.isGhost,
        password: dto.password,
      });

      // Unir socket a la sala
      await client.join(dto.roomCode);
      client.data.roomCode = dto.roomCode;

      // Confirmar al que se unió
      client.emit('room:joined', {
        code: dto.roomCode,
        socketId: client.id,
        participantCount: room.participantCount,
        settings: room.settings,
      });

      // Notificar al resto (solo si no es fantasma)
      if (!dto.isGhost) {
        client.to(dto.roomCode).emit('participant:joined', {
          alias: dto.alias,
          participantCount: room.participantCount,
          roomCode: dto.roomCode,
        });
      }
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('room:destroy')
  async onDestroyRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: DestroyRoomDto,
  ) {
    try {
      const result = await this.destroyRoomUseCase.execute({
        roomCode: dto.roomCode,
        reason: dto.reason,
      });

      // Notificar a TODOS en la sala incluyendo al que lo pidió
      this.server.to(dto.roomCode).emit('room:destroyed', result);

      // Sacar a todos del room de Socket.IO
      const sockets = await this.server.in(dto.roomCode).fetchSockets();
      for (const socket of sockets) {
        socket.leave(dto.roomCode);
      }
    } catch (error) {
      this.emitError(client, error);
    }
  }

  // ── Helper ────────────────────────────────────────────

  private emitError(client: Socket, error: unknown) {
    if (error instanceof DomainError) {
      client.emit('error', { code: error.code, message: error.message });
    } else {
      client.emit('error', { code: 'UNKNOWN', message: 'Error interno' });
      console.error(error);
    }
  }
}