import { Module } from '@nestjs/common';
import { MessageGateway } from './presentation/message.gateway';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [RoomModule],
  providers: [MessageGateway],
})
export class MessageModule {}
