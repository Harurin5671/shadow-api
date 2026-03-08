# Shadow API - Secure Chat System with End-to-End Encryption

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

## Description

Shadow API is a secure chat backend built with NestJS that implements end-to-end encryption (E2E) using the ECDH (Elliptic Curve Diffie-Hellman) protocol. The server acts as a neutral relay that cannot decrypt user messages, guaranteeing total privacy (zero-knowledge).

### Key Features

- 🔐 **End-to-End Encryption**: Messages are encrypted on the client and only decrypted by the recipient
- 🏠 **Temporary Rooms**: Rooms have a 1-hour TTL and are automatically destroyed
- 👻 **Ghost Mode**: Users can join rooms without being detected
- ⏰ **Self-Destructing Messages**: Configurable to delete after being read
- 🚀 **High Performance**: Built with NestJS and Redis for maximum speed

## Installation and Setup

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) / npm
- Redis Server
- macOS (for specific instructions)

### 1. Install Redis on macOS

```bash
# Install Redis using Homebrew
brew install redis

# Start Redis as a service
brew services start redis

# Verify Redis is running
redis-cli ping
# Should respond: PONG
```

### 2. Configure Environment Variables

```bash
# Copy environment variables file
cp .env.example .env

# Edit the .env file with your configuration
# Default values should work for local development
```

Available variables:
```
PORT=3000                    # Server port
REDIS_HOST=localhost         # Redis host
REDIS_PORT=6379              # Redis port
CLIENT_URL=http://localhost:8080  # Client URL (for CORS)
```

### 3. Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

### 4. Run the Application

```bash
# Development mode (with watch)
pnpm run start:dev

# Production mode
pnpm run build
pnpm run start:prod

# Debug mode
pnpm run start:debug
```

The application will start at `http://localhost:3000` by default.

## Stop Redis

When you're done working, you can stop Redis with:

```bash
brew services stop redis
```

## System Architecture

### Main Modules

#### 1. Room Module (`src/modules/room/`)
Manages chat room creation, joining, and destruction.

**Components:**
- `domain/`: Domain entities and repositories
- `application/`: Use cases (CreateRoom, JoinRoom, DestroyRoom)
- `infrastructure/`: Repository implementation with Redis
- `presentation/`: WebSocket gateway for room events

#### 2. Message Module (`src/modules/message/`)
Handles encrypted message relay and key exchange.

**Security Feature:**
The server can NEVER decrypt messages. It only retransmits encrypted bytes.

#### 3. Security Module (`src/modules/security/`)
Provides cryptographic utilities and validations.

#### 4. Core Infrastructure (`src/core/`)
Shared configuration, error handling, and Redis connection.

## Available WebSocket Events

### Room Events

#### 1. Create Room
**Client → Server:**
```typescript
socket.emit('room:create', {
  alias: "MyAlias",
  password: "optional",           // Optional
  maxParticipants: 10,            // Optional, 2-20
  deadManSwitchInterval: 300000,  // Optional, ms
  defaultBurnAfter: 60000         // Optional, seconds
});
```

**Server → Client:**
```typescript
// Success
socket.on('room:created', (data) => {
  console.log(data);
  // {
  //   code: "ABC123",
  //   socketId: "socket_id",
  //   participantCount: 1,
  //   settings: { maxParticipants: 10, password: "..." },
  //   createdAt: "2024-01-01T00:00:00.000Z"
  // }
});

// Error
socket.on('error', (error) => {
  console.log(error.code, error.message);
});
```

#### 2. Join Room
**Client → Server:**
```typescript
socket.emit('room:join', {
  roomCode: "ABC123",
  alias: "MyAlias",
  isGhost: false,              // true for ghost mode
  password: "optional"         // Only if room has password
});
```

**Server → Client:**
```typescript
// Confirmation for the one joining
socket.on('room:joined', (data) => {
  // {
  //   code: "ABC123",
  //   socketId: "socket_id",
  //   participantCount: 2,
  //   settings: { maxParticipants: 10, ... }
  // }
});

// Notification to other participants (if not ghost)
socket.on('participant:joined', (data) => {
  // { alias: "MyAlias", participantCount: 2 }
});
```

#### 3. Destroy Room
**Client → Server:**
```typescript
socket.emit('room:destroy', {
  roomCode: "ABC123",
  reason: "creatorLeft" | "manual" | "deadManSwitch"
});
```

**Server → All:**
```typescript
socket.on('room:destroyed', (data) => {
  // {
  //   reason: "creatorLeft",
  //   destroyedAt: "2024-01-01T00:00:00.000Z"
  // }
});
```

#### 4. Participant Left
**Server → Other participants:**
```typescript
socket.on('participant:left', (data) => {
  // { alias: "MyAlias", participantCount: 1 }
});
```

#### 5. Get My Rooms (NEW)
**Client → Server:**
```typescript
socket.emit('room:getMyRooms');
```

**Server → Client:**
```typescript
socket.on('room:myRooms', (data) => {
  console.log(data);
  // {
  //   rooms: [
  //     {
  //       code: "ABC123",
  //       participantCount: 3,
  //       settings: { maxParticipants: 10, password: "..." },
  //       createdAt: "2024-01-01T00:00:00.000Z",
  //       myRole: "creator" | "participant",
  //       isGhost: false
  //     }
  //   ],
  //   count: 1
  // }
});
```

### Message Events

#### 1. Send Encrypted Message
**Client → Server:**
```typescript
socket.emit('message:send', {
  roomCode: "ABC123",
  encryptedPayload: "base64_encrypted_bytes", // Encrypted message in base64
  senderAlias: "MyAlias",
  burnAfter: 60                                // Optional, seconds
});
```

**Server → Recipients:**
```typescript
socket.on('message:receive', (data) => {
  // {
  //   id: "msg_1640995200000_abcde",
  //   encryptedPayload: "base64_encrypted_bytes",
  //   senderAlias: "MyAlias",
  //   sentAt: "2024-01-01T00:00:00.000Z",
  //   burnAfter: 60
  // }
});

// Confirmation for sender
socket.on('message:sent', (data) => {
  // { id: "msg_1640995200000_abcde", sentAt: "..." }
});
```

#### 2. ECDH Key Exchange
**Client → Server:**
```typescript
socket.emit('key:exchange', {
  roomCode: "ABC123",
  targetSocketId: "target_socket_id",
  wrappedKey: "room_key_encrypted_with_ecdh",
  publicKey: "sender_public_key"
});
```

**Server → Specific recipient:**
```typescript
socket.on('key:receive', (data) => {
  // {
  //   fromSocketId: "sender_socket_id",
  //   wrappedKey: "room_key_encrypted_with_ecdh",
  //   publicKey: "sender_public_key"
  // }
});
```

#### 3. Typing Indicators
**Client → Server:**
```typescript
// Start typing
socket.emit('typing:start', {
  roomCode: "ABC123",
  alias: "MyAlias"
});

// Stop typing
socket.emit('typing:stop', {
  roomCode: "ABC123", 
  alias: "MyAlias"
});
```

**Server → Other participants:**
```typescript
socket.on('typing:start', (data) => {
  // { alias: "MyAlias" }
});

socket.on('typing:stop', (data) => {
  // { alias: "MyAlias" }
});
```

## HTTP Endpoints

The application has a basic HTTP endpoint:

### GET /
```bash
curl http://localhost:3000
# Response: "Hello World!"
```

## Secure Communication Flow

### 1. Secure Channel Establishment

1. **Client A creates a room**
2. **Client B joins the room**
3. **ECDH key exchange**:
   - Client A generates ECDH key and encrypts it with B's public key
   - Client B receives key, decrypts it with their private key
   - Both now share the symmetric room key

### 2. Encrypted Message Sending

1. **Client A encrypts message** with room symmetric key
2. **Sends to server** as `encryptedPayload` (base64)
3. **Server relays** without being able to decrypt
4. **Client B receives and decrypts** with symmetric key

## Common Errors

### Error Codes

- `ROOM_NOT_FOUND`: Room does not exist
- `ROOM_FULL`: Room reached maximum participants
- `INVALID_PASSWORD`: Incorrect password
- `ALREADY_IN_ROOM`: You are already in the room
- `NOT_IN_ROOM`: You are not in the room
- `INSUFFICIENT_PERMISSIONS`: You don't have permissions for this action

## Testing with Postman

### WebSocket Configuration in Postman

1. **Create new WebSocket connection:**
   - Click `+` → `WebSocket`
   - URL: `ws://localhost:3000`
   - Click `Connect`

2. **Room Events to test:**

#### Create Room
```json
{
  "event": "room:create",
  "data": {
    "alias": "Tester",
    "password": "123456",
    "maxParticipants": 5,
    "deadManSwitchInterval": 300000,
    "defaultBurnAfter": 60000
  }
}
```

#### Join Room
```json
{
  "event": "room:join",
  "data": {
    "roomCode": "ABC123",
    "alias": "Participant2",
    "isGhost": false,
    "password": "123456"
  }
}
```

#### Get My Rooms (NEW)
```json
{
  "event": "room:getMyRooms",
  "data": {}
}
```

#### Destroy Room
```json
{
  "event": "room:destroy",
  "data": {
    "roomCode": "ABC123",
    "reason": "manual"
  }
}
```

3. **Message Events to test:**

#### Send Encrypted Message
```json
{
  "event": "message:send",
  "data": {
    "roomCode": "ABC123",
    "encryptedPayload": "YmFzZTY0X2VuY3J5cHRlZF9ieXRlcw==",
    "senderAlias": "Tester",
    "burnAfter": 60
  }
}
```

#### Typing Indicator
```json
{
  "event": "typing:start",
  "data": {
    "roomCode": "ABC123",
    "alias": "Tester"
  }
}
```

#### ECDH Key Exchange
```json
{
  "event": "key:exchange",
  "data": {
    "roomCode": "ABC123",
    "targetSocketId": "target_socket_id",
    "wrappedKey": "encrypted_room_key_with_ecdh",
    "publicKey": "sender_public_key"
  }
}
```

### Complete Test Flow

1. **Connect** to `ws://localhost:3000`
2. **Create room** with `room:create`
3. **Save the room code** returned in `room:created`
4. **Get your rooms** with `room:getMyRooms` to verify
5. **Join with another client** to the same room
6. **Send encrypted messages** with `message:send`
7. **Test typing indicators** with `typing:start/stop`

## Testing

### Run Tests
```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Coverage
pnpm run test:cov
```

### Manual Testing with Socket.IO Client

```javascript
// Example client for testing
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

// Create room
socket.emit('room:create', {
  alias: 'Tester',
  maxParticipants: 5
});

socket.on('room:created', (data) => {
  console.log('Room created:', data);
  
  // Join with another client
  const socket2 = io('http://localhost:3000');
  socket2.emit('room:join', {
    roomCode: data.code,
    alias: 'Tester2',
    isGhost: false
  });
});
```

## Security Considerations

- ✅ **Zero Knowledge**: Server cannot access message content
- ✅ **Perfect Forward Secrecy**: Each session uses unique ECDH keys
- ✅ **Temporal Storage**: Data is automatically deleted (1-hour TTL)
- ✅ **No Metadata Leakage**: Server only knows who is in which room, not content

## Development

### Available Scripts
```bash
pnpm run start:dev    # Development with watch
pnpm run build        # Compile for production
pnpm run lint         # Code linting
pnpm run format       # Format with Prettier
```

### Project Structure
```
src/
├── app.module.ts           # Root module
├── main.ts                 # Entry point
├── core/                   # Shared infrastructure
│   ├── domain/             # Domain errors, VOs
│   └── infrastructure/     # Redis, configuration
├── modules/                # Business modules
│   ├── room/               # Room management
│   ├── message/            # Message relay
│   └── security/           # Security utilities
└── app.controller.ts       # Basic HTTP controller
```

## Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

UNLICENSED - All rights reserved

---

**Important Note:**
This API is designed to be used with a frontend client that implements ECDH encryption/decryption. The server only provides the secure relay infrastructure.
