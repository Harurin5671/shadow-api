// src/modules/room/domain/room.entity.ts
// Room — el Aggregate Root del bounded context de salas
// Solo datos y reglas de negocio, sin dependencias externas

export interface RoomParticipant {
  id: string;          // socket ID
  alias: string;
  isGhost: boolean;
  isCreator: boolean;
  joinedAt: string;    // ISO string (Redis no soporta Date nativo)
}

export interface RoomData {
  code: string;
  participants: RoomParticipant[];
  createdAt: string;
  lastActivityAt: string;
  settings: RoomSettings;
}

export interface RoomSettings {
  maxParticipants: number;
  password?: string;
  deadManSwitchInterval?: number; // segundos, null = desactivado
  defaultBurnAfter?: number;      // segundos, null = no auto-burn
}

export class Room {
  readonly code: string;
  participants: RoomParticipant[];
  createdAt: string;
  lastActivityAt: string;
  settings: RoomSettings;

  constructor(data: RoomData) {
    this.code = data.code;
    this.participants = data.participants;
    this.createdAt = data.createdAt;
    this.lastActivityAt = data.lastActivityAt;
    this.settings = data.settings;
  }

  // Reglas de negocio

  get participantCount(): number {
    return this.participants.filter((p) => !p.isGhost).length;
  }

  canAcceptParticipant(): boolean {
    return this.participants.length < this.settings.maxParticipants;
  }

  hasParticipant(socketId: string): boolean {
    return this.participants.some((p) => p.id === socketId);
  }

  addParticipant(participant: RoomParticipant): void {
    this.participants.push(participant);
    this.recordActivity();
  }

  removeParticipant(socketId: string): RoomParticipant | undefined {
    const index = this.participants.findIndex((p) => p.id === socketId);
    if (index === -1) return undefined;
    const [removed] = this.participants.splice(index, 1);
    return removed;
  }

  recordActivity(): void {
    this.lastActivityAt = new Date().toISOString();
  }

  // Serializar para guardar en Redis
  toJSON(): RoomData {
    return {
      code: this.code,
      participants: this.participants,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      settings: this.settings,
    };
  }

  // Crear desde datos de Redis
  static fromJSON(data: RoomData): Room {
    return new Room(data);
  }

  // Factory — crear sala nueva
  static create(code: string, settings: Partial<RoomSettings> = {}): Room {
    return new Room({
      code,
      participants: [],
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      settings: {
        maxParticipants: settings.maxParticipants ?? 10,
        password: settings.password,
        deadManSwitchInterval: settings.deadManSwitchInterval,
        defaultBurnAfter: settings.defaultBurnAfter,
      },
    });
  }
}