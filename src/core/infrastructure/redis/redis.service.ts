import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

@Injectable()
export class RedisService {
    constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

    async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const json = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, json);
    } else {
      await this.client.set(key, json);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async resetTTL(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  async getTTL(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }
}
