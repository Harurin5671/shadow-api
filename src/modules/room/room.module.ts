import { Module } from '@nestjs/common';
import { RoomGateway } from './presentation/room.gateway';
import { CreateRoomUseCase } from './application/create-room.usecase';
import { JoinRoomUseCase } from './application/join-room.usecase';
import { DestroyRoomUseCase } from './application/destroy-room.usecase';
import { ROOM_REPOSITORY } from './domain/room.repository';
import { RedisRoomRepository } from './infrastructure/redis-room.repository';

@Module({
  providers: [
    RoomGateway,
    CreateRoomUseCase,
    JoinRoomUseCase,
    DestroyRoomUseCase,
    {
      provide: ROOM_REPOSITORY,
      useClass: RedisRoomRepository,
    },
  ],
  exports: [ROOM_REPOSITORY, DestroyRoomUseCase],
})
export class RoomModule {}
