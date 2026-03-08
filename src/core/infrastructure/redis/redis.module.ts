import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const client = new Redis({
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        });

        client.on('connect', () => console.log('✅ Redis conectado'));
        client.on('error', (err) => console.error('❌ Redis error:', err));

        return client;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}