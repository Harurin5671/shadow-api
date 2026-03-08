import { Module } from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './core/infrastructure/redis/redis.module';
import { RoomModule } from './modules/room/room.module';
import { MessageModule } from './modules/message/message.module';
import { SecurityModule } from './modules/security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule,
    RoomModule,
    MessageModule,
    SecurityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
