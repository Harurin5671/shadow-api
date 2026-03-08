// src/modules/security/presentation/security.gateway.ts
// Retransmite alertas de seguridad entre participantes
// Screenshot, grabacion, portapapeles, dead man's switch

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { IsString } from 'class-validator';

type ThreatType =
  | 'screenshot'
  | 'screenRecording'
  | 'clipboardCopy'
  | 'exportAttempt';

class SecurityAlertDto {
  @IsString() roomCode: string;
  @IsString() threatType: ThreatType;
  @IsString() reporterAlias: string;
}

class DeadManCheckInDto {
  @IsString() roomCode: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class SecurityGateway {
  @WebSocketServer()
  server: Server;

  // ── Alerta de seguridad ───────────────────────────────
  // Un cliente detectó captura/grabacion y avisa a todos
  @SubscribeMessage('security:alert')
  onSecurityAlert(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SecurityAlertDto,
  ) {
    // Notificar a TODOS en la sala incluyendo al reportero
    this.server.to(dto.roomCode).emit('security:alert', {
      threatType: dto.threatType,
      reporterAlias: dto.reporterAlias,
      detectedAt: new Date().toISOString(),
    });
  }

  // ── Dead Man's Switch check-in ────────────────────────
  // El creador confirma que sigue presente
  @SubscribeMessage('deadman:checkin')
  onDeadManCheckIn(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: DeadManCheckInDto,
  ) {
    // Confirmar check-in al creador
    client.emit('deadman:confirmed', {
      confirmedAt: new Date().toISOString(),
    });
  }

  // ── Dead Man's Warning ────────────────────────────────
  // El cliente avisa que su dead man's switch está a punto de disparar
  @SubscribeMessage('deadman:warning')
  onDeadManWarning(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; secondsLeft: number },
  ) {
    // Notificar a todos que el DMS está a punto de disparar
    this.server.to(data.roomCode).emit('deadman:warning', {
      secondsLeft: data.secondsLeft,
    });
  }
}