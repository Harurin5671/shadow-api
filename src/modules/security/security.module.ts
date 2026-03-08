import { Module } from '@nestjs/common';
import { SecurityGateway } from './presentation/security.gateway';

@Module({
  providers: [SecurityGateway],
})
export class SecurityModule {}
