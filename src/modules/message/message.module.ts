import { Module } from '@nestjs/common';
import { MessageGateway } from './presentation/message.gateway';

@Module({
  providers: [MessageGateway],
})
export class MessageModule {}
