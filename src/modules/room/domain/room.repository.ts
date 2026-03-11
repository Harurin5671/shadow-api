import { Room } from './room.entity';

export const ROOM_REPOSITORY = 'ROOM_REPOSITORY';

export interface RoomRepository {
  // Guardar sala en Redis con TTL de 1 hora
  save(room: Room): Promise<void>;

  // Guardar sala sin afectar el TTL existente
  saveWithoutTTL(room: Room): Promise<void>;

  // Guardar sala manteniendo el TTL actual
  savePreservingTTL(room: Room): Promise<void>;

  // Obtener tiempo restante de expiración
  getTTL(code: string): Promise<number>;

  // Buscar sala por codigo
  findByCode(code: string): Promise<Room | null>;

  // Buscar todas las salas donde participa un usuario
  findByParticipant(socketId: string): Promise<Room[]>;

  // Borrar sala
  delete(code: string): Promise<void>;

  // Verificar si existe
  exists(code: string): Promise<boolean>;

  // Resetear el TTL de 1 hora (cuando hay actividad)
  resetExpiry(code: string): Promise<void>;

  // ── Métodos para mensajes temporales ────────────────────
  // Guardar mensaje cifrado con TTL
  saveMessage(roomCode: string, messageId: string, message: any, ttl?: number): Promise<void>;
  
  // Obtener todos los mensajes de una sala
  getRoomMessages(roomCode: string): Promise<any[]>;
  
  // Eliminar mensaje específico
  deleteMessage(roomCode: string, messageId: string): Promise<void>;
}
