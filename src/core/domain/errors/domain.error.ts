export class DomainError extends Error {
    constructor(
        message: string,
        public readonly code: string,
    ) {
        super(message);
        this.name = 'DomainError';
    }
}

export class RoomNotFoundError extends DomainError {
  constructor(roomCode: string) {
    super(`Sala '${roomCode}' no encontrada o ya expiró`, 'ROOM_NOT_FOUND');
  }
}

export class RoomFullError extends DomainError {
  constructor() {
    super('La sala alcanzó el límite de participantes', 'ROOM_FULL');
  }
}

export class RoomAlreadyExistsError extends DomainError {
  constructor(roomCode: string) {
    super(`La sala '${roomCode}' ya existe`, 'ROOM_ALREADY_EXISTS');
  }
}

export class InvalidRoomCodeError extends DomainError {
  constructor(code: string) {
    super(`Código de sala inválido: '${code}'`, 'INVALID_ROOM_CODE');
  }
}

export class WrongPasswordError extends DomainError {
  constructor() {
    super('Contraseña incorrecta', 'WRONG_PASSWORD');
  }
}

export class ParticipantNotFoundError extends DomainError {
  constructor() {
    super('Participante no encontrado en la sala', 'PARTICIPANT_NOT_FOUND');
  }
}