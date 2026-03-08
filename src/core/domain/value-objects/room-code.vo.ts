import { InvalidRoomCodeError } from '../errors/domain.error';

export class RoomCode {
  readonly value: string;

  constructor(raw: string) {
    const upper = raw.toUpperCase().trim();
    if (upper.length !== 4 || !/^[A-Z0-9]+$/.test(upper)) {
      throw new InvalidRoomCodeError(raw);
    }
    this.value = upper;
  }

  static generate(): RoomCode {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    const raw = Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('');

    return new RoomCode(raw);
  }

  toString(): string {
    return this.value;
  }
}

export class Alias {
  readonly value: string;

  constructor(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 20) {
      throw new Error('Alias inválido');
    }
    this.value = trimmed;
  }

  toString(): string {
    return this.value;
  }
}
