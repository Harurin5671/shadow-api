import { Injectable, Inject } from '@nestjs/common';
import { Room } from '../domain/room.entity';
import type { RoomSettings } from '../domain/room.entity';
import type { RoomRepository } from '../domain/room.repository';
import { ROOM_REPOSITORY } from '../domain/room.repository';
import { RoomCode } from '../../../core/domain/value-objects/room-code.vo';

export interface CreateRoomInput {
  creatorSocketId: string;
  creatorAlias: string;
  settings?: Partial<RoomSettings>;
}

export interface CreateRoomOutput {
  room: Room;
  code: string;
}

@Injectable()
export class CreateRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly roomRepository: RoomRepository,
  ) {}

  async execute(input: CreateRoomInput): Promise<CreateRoomOutput> {
    // Generar codigo unico — reintentar si ya existe
    let code: RoomCode;
    let attempts = 0;

    do {
      code = RoomCode.generate();
      attempts++;
      if (attempts > 10) throw new Error('No se pudo generar código único');
    } while (await this.roomRepository.exists(code.value));

    // Crear la sala
    const room = Room.create(code.value, input.settings);

    // Agregar al creador como primer participante
    room.addParticipant({
      id: input.creatorSocketId,
      alias: input.creatorAlias,
      isGhost: false,
      isCreator: true,
      joinedAt: new Date().toISOString(),
    });

    // Guardar en Redis con TTL de 1 hora
    await this.roomRepository.save(room);

    return { room, code: code.value };
  }
}
