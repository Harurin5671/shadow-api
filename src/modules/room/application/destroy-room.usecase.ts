import { Injectable, Inject } from '@nestjs/common';
import type { RoomRepository } from '../domain/room.repository';
import { ROOM_REPOSITORY } from '../domain/room.repository';
import { RoomNotFoundError } from '../../../core/domain/errors/domain.error';

export type DestructionReason =
  | 'timeout'
  | 'panic'
  | 'deadManSwitch'
  | 'screenshotDetected'
  | 'exportAttempted'
  | 'creatorLeft';

export interface DestroyRoomInput {
  roomCode: string;
  reason: DestructionReason;
}

export interface DestroyRoomOutput {
  code: string;
  reason: DestructionReason;
  destroyedAt: string;
}

@Injectable()
export class DestroyRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly roomRepository: RoomRepository,
  ) {}

  async execute(input: DestroyRoomInput): Promise<DestroyRoomOutput> {
    const exists = await this.roomRepository.exists(input.roomCode);
    if (!exists) throw new RoomNotFoundError(input.roomCode);

    // Borrar de Redis — los datos desaparecen para siempre
    await this.roomRepository.delete(input.roomCode);

    return {
      code: input.roomCode,
      reason: input.reason,
      destroyedAt: new Date().toISOString(),
    };
  }
}
