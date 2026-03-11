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
- **Temporary Rooms** with 1-hour TTL (non-resettable)
- **Room Creator Identification** - Always know who created the room
- **Ghost Mode** for invisible participation
- **Self-destructing messages**
- **High Performance** with NestJS + Redis
- **TTL Preservation** - Room duration maintained during user joins/exits

## 📡 Available Events

### Room Events
- `room:create` - Create new room
- `room:join` - Join existing room (includes creator info)
- `room:destroy` - Destroy room
- `room:getMyRooms` - Get all rooms where you're participating (includes creator info)
- `room:getMessages` - Get message history from a room
- `participant:joined/left` - Participant notifications

### Message Events
- `message:send` - Send encrypted message
- `message:receive` - Receive encrypted message
- `key:exchange` - ECDH key exchange (broadcast to room)
- `room:key:share` - Share room key (creator only)
- `room:key:receive` - Receive room key (participants)
- `security:alert` - Security threat reporting
- `room:verify` - Verify room status
- `typing:start/stop` - Typing indicators

## 🔄 Recent Updates

### ✨ TTL Management (Latest)
- **Fixed Room Duration**: Rooms now last exactly 1 hour from creation
- **Non-resettable TTL**: User joins/exits no longer extend room duration
- **TTL Preservation**: `savePreservingTTL()` method maintains remaining time
- **Accurate Time Display**: `expiresInSeconds` shows correct remaining time

### 👤 Creator Identification
- **Room Creator Info**: `room:joined` and `room:getMyRooms` include creator details
- **Creator Socket ID**: Always know who to request room key from
- **Role Detection**: Distinguish between creator and participant roles

### 🔐 Security Enhancements
- **Zero-Knowledge**: Server never stores room keys or private keys
- **ECDH Key Exchange**: Secure peer-to-peer key sharing
- **Encrypted Payloads**: All message content encrypted client-side
- **Public Key Validation**: Validates P256 key formats
- **Rate Limiting**: Prevents abuse in key exchanges
- **Security Alerts**: Real-time threat detection from iOS
- **Room Verification**: Validate room status before joining

---

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

## 🧪 Testing

### Test Client
Open `test-client.html` in your browser to test all events.

#### **Basic Room Events:**
1. **Connect** to server
2. **Create room** with alias and configuration  
3. **Join room** with code and alias
4. **Get my rooms** to see participants and creator
5. **Verify room** to validate room status

#### **Dynamic Room Events (NEW):**
1. **Key Exchange Broadcast:**
   - Enter room code, your alias, and public key (base64)
   - Click "Send Public Key (Broadcast)"
   - Everyone in room will receive your public key

2. **Key Exchange to Specific Target:**
   - Enter target socket ID
   - Click "Send to Specific Target"
   - Only that participant will receive your public key

3. **Room Key Distribution (Creator Only):**
   - Enter room code, target alias, and encrypted room key
   - Click "Share Room Key"
   - Only creator can use this function

#### **Security Events:**
1. **Room Verification:**
   - Enter room code
   - Click "Verify Room"
   - You'll receive complete room status

2. **Security Alerts:**
   - Select alert type (compromised key, suspicious activity, etc.)
   - Click "Send Security Alert"
   - Everyone in room will receive the alert

#### **Complete Test Flow:**
```
1. Connect to server
2. Create room (Alice)
3. Join with another client (Bob)
4. Alice: Send public key (broadcast)
5. Bob: Send public key (broadcast)
6. Alice: Share room key with Bob
7. Both: Send encrypted messages
8. Test security alerts
9. Verify room status
10. Test typing indicators
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
