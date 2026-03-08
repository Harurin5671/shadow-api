# Shadow API - Secure Chat with E2E Encryption

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

A secure chat backend built with NestJS implementing end-to-end encryption using ECDH protocol. The server acts as a neutral relay that cannot decrypt user messages (zero-knowledge).

## 📚 Documentation

- **🇪🇸 [Documentation in Spanish](./README_DOC_ES.md)** - Documentación completa en español
- **🇺🇸 [Documentation in English](./README_DOC_EN.md)** - Complete documentation in English

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm (recommended) / npm
- Redis Server

### Install Redis (macOS)
```bash
brew install redis
brew services start redis
redis-cli ping  # Should respond: PONG
```

### Setup & Run
```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Run in development mode
pnpm run start:dev
```

The application will start at `http://localhost:3000`.

### Stop Redis
```bash
brew services stop redis
```

## 🔐 Key Features

- **End-to-End Encryption** using ECDH
- **Zero Knowledge** - Server cannot decrypt messages
- **Temporary Rooms** with 1-hour TTL
- **Ghost Mode** for invisible participation
- **Self-destructing messages**
- **High Performance** with NestJS + Redis

## 📡 Available Events

### Room Events
- `room:create` - Create new room
- `room:join` - Join existing room (ghost mode available)
- `room:destroy` - Destroy room
- `room:getMyRooms` - Get all rooms where you're participating (NEW)
- `participant:joined/left` - Participant notifications

### Message Events
- `message:send` - Send encrypted message
- `message:receive` - Receive encrypted message
- `key:exchange` - ECDH key exchange
- `typing:start/stop` - Typing indicators

## 🏗️ Architecture

```
src/
├── modules/
│   ├── room/         # Room management
│   ├── message/      # Message relay (encrypted)
│   └── security/     # Crypto utilities
├── core/
│   ├── domain/       # Domain entities
│   └── infrastructure/ # Redis connection
└── main.ts
```

## 🧪 Testing with Postman

### Quick Setup
1. **Connect to WebSocket**: `ws://localhost:3000`
2. **Create room**: 
   ```json
   {"event": "room:create", "data": {"alias": "Tester", "maxParticipants": 5}}
   ```
3. **Get your rooms**: 
   ```json
   {"event": "room:getMyRooms", "data": {}}
   ```

For detailed Postman examples, see:
- [🇪🇸 Testing section (Spanish)](./README_DOC_ES.md#testing-con-postman)
- [🇺🇸 Testing section (English)](./README_DOC_EN.md#testing-with-postman)

## 🔧 Development Scripts

```bash
pnpm run start:dev    # Development with watch
pnpm run build        # Build for production
pnpm run test         # Run tests
pnpm run lint         # Lint code
```

## 📄 License

UNLICENSED - All rights reserved

---

**⚠️ Important:** This API requires a frontend client implementing ECDH encryption/decryption. The server only provides secure relay infrastructure.

For detailed documentation, see [README_DOC_ES.md](./README_DOC_ES.md) (Spanish) or [README_DOC_EN.md](./README_DOC_EN.md) (English).
