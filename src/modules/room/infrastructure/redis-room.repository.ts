import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../core/infrastructure/redis/redis.service';
import { Room } from '../domain/room.entity';
import { RoomRepository } from '../domain/room.repository';

const ROOM_TTL = 3600; // 1 hora en segundos
const ROOM_KEY = (code: string) => `room:${code}`;
const MESSAGE_KEY = (roomCode: string, messageId: string) => `messages:${roomCode}:${messageId}`;
const ROOM_PATTERN = 'room:*';
const MESSAGE_PATTERN = (roomCode: string) => `messages:${roomCode}:*`;

@Injectable()
export class RedisRoomRepository implements RoomRepository {
  constructor(private readonly redis: RedisService) {}

  async save(room: Room): Promise<void> {
    await this.redis.set(ROOM_KEY(room.code), room.toJSON(), ROOM_TTL);
  }

  async saveWithoutTTL(room: Room): Promise<void> {
    await this.redis.set(ROOM_KEY(room.code), room.toJSON());
  }

  async savePreservingTTL(room: Room): Promise<void> {
    const key = ROOM_KEY(room.code);
    const currentTTL = await this.redis.getTTL(key);
    
    console.log(`🔍 [RedisRepository] savePreservingTTL para sala ${room.code}:`, {
      currentTTL: currentTTL,
      roomTTL: ROOM_TTL,
      willPreserve: currentTTL > 0,
      participantCount: room.participantCount
    });
    
    await this.redis.set(key, room.toJSON(), currentTTL > 0 ? currentTTL : ROOM_TTL);
    
    // Verificar que se aplicó correctamente
    const newTTL = await this.redis.getTTL(key);
    console.log(`📊 [RedisRepository] TTL después de guardar:`, {
      newTTL: newTTL,
      preserved: newTTL === currentTTL,
      difference: newTTL - currentTTL
    });
  }

  async getTTL(code: string): Promise<number> {
    return this.redis.getTTL(ROOM_KEY(code));
  }

  async findByCode(code: string): Promise<Room | null> {
    const data = await this.redis.get<ReturnType<Room['toJSON']>>(
      ROOM_KEY(code),
    );
    if (!data) return null;
    return Room.fromJSON(data);
  }

  async findByParticipant(socketId: string): Promise<Room[]> {
    
    // Obtener todas las keys de rooms
    const roomKeys = await this.redis.keys(ROOM_PATTERN);
    
    const userRooms: Room[] = [];

    // Buscar en cada room si el usuario está participando
    for (const key of roomKeys) {
      const data = await this.redis.get<ReturnType<Room['toJSON']>>(key);
      if (!data) {
        continue;
      }

      const room = Room.fromJSON(data);
      const participant = room.participants.find(p => p.id === socketId);
      
      
      if (participant) {
        userRooms.push(room);
      }
    }

    return userRooms;
  }

  async delete(code: string): Promise<void> {
    await this.redis.del(ROOM_KEY(code));
  }

  async exists(code: string): Promise<boolean> {
    return this.redis.exists(ROOM_KEY(code));
  }

  async resetExpiry(code: string): Promise<void> {
    await this.redis.resetTTL(ROOM_KEY(code), ROOM_TTL);
  }

  async resetTTL(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.resetTTL(key, ttlSeconds);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  // ── Métodos para mensajes temporales ────────────────────

  async saveMessage(roomCode: string, messageId: string, message: any, ttl: number = ROOM_TTL): Promise<void> {
    const key = MESSAGE_KEY(roomCode, messageId);
    await this.redis.set(key, message, ttl);
  }

  async getRoomMessages(roomCode: string): Promise<any[]> {
    const messageKeys = await this.redis.keys(MESSAGE_PATTERN(roomCode));
    const messages: any[] = [];

    for (const key of messageKeys) {
      const message = await this.redis.get(key);
      if (message) {
        messages.push(message);
      }
    }

    // Ordenar por timestamp (sentAt)
    messages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    
    return messages;
  }

  async deleteMessage(roomCode: string, messageId: string): Promise<void> {
    const key = MESSAGE_KEY(roomCode, messageId);
    await this.redis.del(key);
  }
}