import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../core/infrastructure/redis/redis.service';
import { Room } from '../domain/room.entity';
import { RoomRepository } from '../domain/room.repository';

const ROOM_TTL = 3600; // 1 hora en segundos
const ROOM_KEY = (code: string) => `room:${code}`;
const ROOM_PATTERN = 'room:*';

@Injectable()
export class RedisRoomRepository implements RoomRepository {
  constructor(private readonly redis: RedisService) {}

  async save(room: Room): Promise<void> {
    await this.redis.set(ROOM_KEY(room.code), room.toJSON(), ROOM_TTL);
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
}