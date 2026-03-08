import { Injectable, Inject } from '@nestjs/common';
import { Room } from '../domain/room.entity';
import type { RoomRepository } from '../domain/room.repository';
import { ROOM_REPOSITORY } from '../domain/room.repository';
import {
  RoomNotFoundError,
  RoomFullError,
  WrongPasswordError,
} from '../../../core/domain/errors/domain.error';

export interface JoinRoomInput {
  roomCode: string;
  socketId: string;
  alias: string;
  isGhost: boolean;
  password?: string;
}

export interface JoinRoomOutput {
  room: Room;
}

@Injectable()
export class JoinRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly roomRepository: RoomRepository,
  ) {}

  async execute(input: JoinRoomInput): Promise<JoinRoomOutput> {
    console.log(`🔍 [JoinRoomUseCase] Datos recibidos:`, input);
    
    if (!input.roomCode) {
      console.error(`❌ [JoinRoomUseCase] roomCode es undefined o nulo`);
      throw new RoomNotFoundError('roomCode no proporcionado');
    }
    
    console.log(`🏠 [JoinRoomUseCase] Buscando sala: ${input.roomCode}`);
    
    // Buscar sala
    const room = await this.roomRepository.findByCode(
      input.roomCode.toUpperCase(),
    );
    
    console.log(`📊 [JoinRoomUseCase] Sala encontrada:`, room ? 'SÍ' : 'NO');
    
    if (!room) throw new RoomNotFoundError(input.roomCode);

    // Verificar capacidad
    if (!room.canAcceptParticipant()) throw new RoomFullError();

    // Verificar contraseña si la tiene
    if (room.settings.password && room.settings.password !== input.password) {
      throw new WrongPasswordError();
    }

    // Agregar participante
    room.addParticipant({
      id: input.socketId,
      alias: input.alias,
      isGhost: input.isGhost,
      isCreator: false,
      joinedAt: new Date().toISOString(),
    });

    // Guardar y resetear TTL
    await this.roomRepository.save(room);

    return { room };
  }
}
