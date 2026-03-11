# Shadow API - Sistema de Chat Seguro con Cifrado End-to-End

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

## Descripción

Shadow API es un backend de chat seguro construido con NestJS que implementa cifrado end-to-end (E2E) utilizando el protocolo ECDH (Elliptic Curve Diffie-Hellman). El servidor funciona como un relay neutral que no puede descifrar los mensajes de los usuarios, garantizando privacidad total (zero-knowledge).

### Características Principales

- 🔐 **Cifrado End-to-End**: Los mensajes se cifran en el cliente y solo se descifran en el destinatario
- 🏠 **Salas Temporales**: Las salas tienen un TTL de 1 hora exacto (no reiniciable)
- 👤 **Identificación de Creador**: Siempre sabes quién creó cada sala
- 👻 **Modo Fantasma**: Usuarios pueden unirse a salas sin ser detectados
- ⏰ **Mensajes Auto-Destructivos**: Configurables para eliminarse después de ser leídos
- 🚀 **Alto Rendimiento**: Construido con NestJS y Redis para máxima velocidad
- ⏱️ **Preservación de TTL**: La duración de la sala se mantiene durante uniones/salidas

## Instalación y Configuración

### Prerrequisitos

- Node.js 18+ 
- pnpm (recomendado) / npm
- Redis Server
- macOS (para las instrucciones específicas)

### 1. Instalar Redis en macOS

```bash
# Instalar Redis usando Homebrew
brew install redis

# Iniciar Redis como servicio
brew services start redis

# Verificar que Redis está corriendo
redis-cli ping
# Debería responder: PONG
```

### 2. Configurar Variables de Entorno

```bash
# Copiar archivo de variables de entorno
cp .env.example .env

# Editar el archivo .env con tu configuración
# Los valores por defecto deberían funcionar para desarrollo local
```

Variables disponibles:
```
PORT=3000                    # Puerto del servidor
REDIS_HOST=localhost         # Host de Redis
REDIS_PORT=6379              # Puerto de Redis
CLIENT_URL=http://localhost:8080  # URL del cliente (para CORS)
```

### 3. Instalar Dependencias

```bash
# Usando pnpm (recomendado)
pnpm install

# O usando npm
npm install
```

### 4. Ejecutar la Aplicación

```bash
# Modo desarrollo (con watch)
pnpm run start:dev

# Modo producción
pnpm run build
pnpm run start:prod

# Modo debug
pnpm run start:debug
```

La aplicación iniciará en `http://localhost:3000` por defecto.

## Detener Redis

Cuando termines de trabajar, puedes detener Redis con:

```bash
brew services stop redis
```

## 🔄 Actualizaciones Recientes

### ✨ Gestión de TTL (Último)
- **Duración Fija de Salas**: Las salas ahora duran exactamente 1 hora desde creación
- **TTL No Reiniciable**: Las uniones/salidas de usuarios ya no extienden la duración
- **Preservación de TTL**: Método `savePreservingTTL()` mantiene el tiempo restante
- **Tiempo Exacto**: `expiresInSeconds` muestra el tiempo restante correcto

### 👤 Identificación de Creador
- **Info del Creador**: `room:joined` y `room:getMyRooms` incluyen detalles del creador
- **Socket ID del Creador**: Siempre sabes a quién solicitar la room key
- **Detección de Rol**: Distinguir entre rol de creador y participante

### 🔐 Mejoras de Seguridad
- **Zero-Knowledge**: Servidor nunca almacena room keys ni claves privadas
- **Intercambio ECDH**: Compartición segura de claves peer-to-peer
- **Payloads Cifrados**: Todo el contenido de mensajes se cifra del lado del cliente
- **Validación de Claves Públicas**: Valida formatos de clave P256
- **Rate Limiting**: Previene abuso en intercambios de claves
- **Alertas de Seguridad**: Detección de amenazas en tiempo real desde iOS
- **Verificación de Salas**: Validar estado de sala antes de unirse

---

## Arquitectura del Sistema

### Módulos Principales

#### 1. Room Module (`src/modules/room/`)
Gestiona la creación, unión y destrucción de salas de chat.

**Componentes:**
- `domain/`: Entidades de dominio y repositorios
- `application/`: Casos de uso (CreateRoom, JoinRoom, DestroyRoom)
- `infrastructure/`: Implementación del repositorio con Redis
- `presentation/`: Gateway de WebSocket para eventos de sala

#### 2. Message Module (`src/modules/message/`)
Maneja el relay de mensajes cifrados y el intercambio de claves.

**Característica de Seguridad:**
El servidor NUNCA puede descifrar los mensajes. Solo retransmite bytes cifrados.

#### 3. Security Module (`src/modules/security/`)
Proporciona utilidades criptográficas y validaciones.

#### 4. Core Infrastructure (`src/core/`)
Configuración compartida, manejo de errores y conexión a Redis.

## Eventos de WebSocket Disponibles

### Eventos de Sala

#### 1. Crear Sala
**Cliente → Servidor:**
```typescript
socket.emit('room:create', {
  alias: "MiAlias",
  password: "opcional",           // Opcional
  maxParticipants: 10,            // Opcional, 2-20
  deadManSwitchInterval: 300000,  // Opcional, ms
  defaultBurnAfter: 60000         // Opcional, segundos
});
```

**Servidor → Cliente:**
```typescript
// Éxito
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

#### 2. Unirse a Sala
**Cliente → Servidor:**
```typescript
socket.emit('room:join', {
  roomCode: "ABC123",
  alias: "MiAlias",
  isGhost: false,              // true para modo fantasma
  password: "opcional"         // Solo si la sala tiene contraseña
});
```

**Servidor → Cliente:**
```typescript
// Confirmación para quien se une
socket.on('room:joined', (data) => {
  // {
  //   code: "ABC123",
  //   socketId: "socket_id",
  //   participantCount: 2,
  //   settings: { maxParticipants: 10, ... },
  //   creator: {                    // ← NUEVO: Información del creador
  //     socketId: "creator_socket_id",
  //     alias: "NombreDelCreador"
  //   }
  // }
});

// Notificación a otros participantes (si no es fantasma)
socket.on('participant:joined', (data) => {
  // { alias: "MiAlias", participantCount: 2 }
});
```

#### 3. Destruir Sala
**Cliente → Servidor:**
```typescript
socket.emit('room:destroy', {
  roomCode: "ABC123",
  reason: "creatorLeft" | "manual" | "deadManSwitch"
});
```

**Servidor → Todos:**
```typescript
socket.on('room:destroyed', (data) => {
  // {
  //   reason: "creatorLeft",
  //   destroyedAt: "2024-01-01T00:00:00.000Z"
  // }
});
```

#### 4. Participante se va
**Servidor → Resto de participantes:**
```typescript
socket.on('participant:left', (data) => {
  // { alias: "MiAlias", participantCount: 1 }
});
```

#### 5. Obtener Mis Salas
**Cliente → Servidor:**
```typescript
socket.emit('room:getMyRooms');
```

**Servidor → Cliente:**
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
  //       creator: {                    // ← NUEVO: Información del creador
  //         socketId: "creator_socket_id",
  //         alias: "NombreDelCreador"
  //       },
  //       myRole: "creator" | "participant",
  //       isGhost: false,
  //       expiresInSeconds: 3540        // ← NUEVO: Tiempo restante exacto
  //     }
  //   ],
  //   count: 1
  // }
});
```

#### 6. Obtener Historial de Mensajes (NUEVO)
**Cliente → Servidor:**
```typescript
socket.emit('room:getMessages', {
  roomCode: "ABC123"
});
```

**Servidor → Cliente:**
```typescript
socket.on('room:messages', (data) => {
  console.log(data);
  // {
  //   roomCode: "ABC123",
  //   messages: [
  //     {
  //       id: "msg_123456_abcde",
  //       encryptedPayload: "base64_encrypted_bytes",
  //       senderAlias: "OtroUsuario",
  //       sentAt: "2026-03-08T16:30:00.000Z",
  //       burnAfter: 60
  //     }
  //   ],
  //   count: 5
  // }
});
```

### Eventos de Mensajes

#### 1. Enviar Mensaje Cifrado
**Cliente → Servidor:**
```typescript
socket.emit('message:send', {
  roomCode: "ABC123",
  encryptedPayload: "mensaje_cifrado_en_base64",
  senderAlias: "MiAlias",
  burnAfter: 300  // opcional - segundos para auto-destruir
});
```

**Servidor → Destinatarios:**
```typescript
socket.on('message:receive', (data) => {
  // {
  //   id: "msg_1640995200000_abcde",
  //   encryptedPayload: "base64_encrypted_bytes",
  //   senderAlias: "MiAlias",
  //   sentAt: "2024-01-01T00:00:00.000Z",
  //   burnAfter: 60
  // }
});

// Confirmación para el emisor
socket.on('message:sent', (data) => {
  // { id: "msg_1640995200000_abcde", sentAt: "..." }
});
```

#### 2. Intercambio de Claves ECDH (Sala Dinámica)
**Cliente → Servidor:**
```typescript
// Broadcast de clave pública a toda la sala
socket.emit('key:exchange', {
  roomCode: "ABC123",
  publicKey: "clave_pública_P256_en_base64",
  participantAlias: "MiAlias"
  // NOTA: No hay targetSocketId - es broadcast a sala completa
});

// Opcional: Enviar a participante específico
socket.emit('key:exchange', {
  roomCode: "ABC123",
  targetSocketId: "socket_id_específico",
  publicKey: "clave_pública_P256_en_base64",
  participantAlias: "MiAlias"
});
```

**Servidor → Todos en sala:**
```typescript
socket.on('key:receive', (data) => {
  // {
  //   fromSocketId: "socket_id_emisor",
  //   fromAlias: "AliasDelEmisor",
  //   publicKey: "clave_pública",
  //   timestamp: 1640995200000
  // }
});
```

#### 3. Distribución de Room Key (Solo Creador) - NUEVO
**Cliente → Servidor:**
```typescript
// Solo el creador puede compartir room keys
socket.emit('room:key:share', {
  roomCode: "ABC123",
  targetParticipant: "AliasDestino",  // Alias del participante
  wrappedRoomKey: "room_key_encriptada_con_ECDH",
  senderAlias: "AliasDelCreador"
});
```

**Servidor → Participante específico:**
```typescript
socket.on('room:key:receive', (data) => {
  // {
  //   roomCode: "ABC123",
  //   wrappedRoomKey: "room_key_encriptada",
  //   senderAlias: "AliasDelCreador",
  //   timestamp: 1640995200000
  // }
});
```

#### 3. Indicadores de Escritura
**Cliente → Servidor:**
```typescript
// Comenzar a escribir
socket.emit('typing:start', {
  roomCode: "ABC123",
  alias: "MiAlias"
});

// Dejar de escribir
socket.emit('typing:stop', {
  roomCode: "ABC123", 
  alias: "MiAlias"
});
```

**Servidor → Otros participantes:**
```typescript
socket.on('typing:start', (data) => {
  // { alias: "MiAlias" }
});

socket.on('typing:stop', (data) => {
  // { alias: "MiAlias" }
});
```

## Endpoints HTTP

La aplicación tiene un endpoint HTTP básico:

### GET /
```bash
curl http://localhost:3000
# Respuesta: "Hello World!"
```

## Flujo de Comunicación Segura

### 1. Establecimiento de Canal Seguro

1. **Cliente A crea una sala**
2. **Cliente B se une a la sala**
3. **Intercambio de claves ECDH**:
   - Cliente A genera clave ECDH y la cifra con la pública de B
   - Cliente B recibe clave, la descifra con su privada
   - Ambos ahora comparten la clave simétrica de sala

### 2. Envío de Mensajes Cifrados

1. **Cliente A cifra mensaje** con clave simétrica de sala
2. **Envía al servidor** como `encryptedPayload` (base64)
3. **Servidor retransmite** sin poder descifrar
4. **Cliente B recibe y descifra** con clave simétrica

## Errores Comunes

### Códigos de Error

- `ROOM_NOT_FOUND`: La sala no existe
- `ROOM_FULL`: La sala alcanzó el máximo de participantes
- `INVALID_PASSWORD`: Contraseña incorrecta
- `ALREADY_IN_ROOM`: Ya estás en la sala
- `NOT_IN_ROOM`: No estás en la sala
- `INSUFFICIENT_PERMISSIONS`: No tienes permisos para esta acción

## Testing con Postman

### Configuración de WebSocket en Postman

1. **Crear nueva conexión WebSocket:**
   - Click en `+` → `WebSocket`
   - URL: `ws://localhost:3000`
   - Click en `Connect`

2. **Eventos de Sala para probar:**

#### Crear Sala
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

#### Unirse a Sala
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

#### Obtener Mis Salas (NUEVO)
```json
{
  "event": "room:getMyRooms",
  "data": {}
}
```

#### Obtener Historial de Mensajes (NUEVO)
```json
{
  "event": "room:getMessages",
  "data": {
    "roomCode": "ABC123"
  }
}
```

#### Destruir Sala
```json
{
  "event": "room:destroy",
  "data": {
    "roomCode": "ABC123",
    "reason": "manual"
  }
}
```

3. **Eventos de Mensajes para probar:**

#### Enviar Mensaje Cifrado
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

#### Indicador de Escritura
```json
{
  "event": "typing:start",
  "data": {
    "roomCode": "ABC123",
    "alias": "Tester"
  }
}
```

#### Intercambio de Claves ECDH
```json
{
  "event": "key:exchange",
  "data": {
    "roomCode": "ABC123",
    "targetSocketId": "socket_id_destino",
    "wrappedKey": "clave_cifrada_con_ecdh",
    "publicKey": "clave_publica_emisor"
  }
}
```

### Flujo Completo de Prueba

1. **Conectar** a `ws://localhost:3000`
2. **Crear sala** con `room:create`
3. **Guardar el código** de sala devuelto en `room:created`
4. **Obtener tus salas** con `room:getMyRooms` para verificar
5. **Unirse con otro cliente** a la misma sala
6. **Enviar mensajes** cifrados con `message:send`
7. **Probar indicadores** de escritura con `typing:start/stop`

## Testing

### Ejecutar Tests
```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Coverage
pnpm run test:cov
```

### Probar Manualmente con Test Client

Abre `test-client.html` en tu navegador para probar todos los eventos.

#### **Eventos de Sala Básicos:**
1. **Conectar** al servidor
2. **Crear sala** con alias y configuración
3. **Unirse a sala** con código y alias
4. **Obtener mis salas** para ver participantes y creador
5. **Verificar sala** para validar estado

#### **Eventos de Salas Dinámicas (NUEVOS):**
1. **Key Exchange Broadcast:**
   - Ingresa código de sala, tu alias y clave pública (base64)
   - Click "Enviar Clave Pública (Broadcast)"
   - Todos en la sala recibirán tu clave pública

2. **Key Exchange a Target Específico:**
   - Ingresa socket ID del destinatario
   - Click "Enviar a Target Específico"
   - Solo ese participante recibirá tu clave pública

3. **Distribución de Room Key (Solo Creador):**
   - Ingresa código de sala, alias del destino y room key encriptada
   - Click "Compartir Room Key"
   - Solo el creador puede usar esta función

#### **Eventos de Seguridad:**
1. **Verificación de Sala:**
   - Ingresa código de sala
   - Click "Verificar Room"
   - Recibirás estado completo de la sala

2. **Alertas de Seguridad:**
   - Selecciona tipo de alerta (clave comprometida, actividad sospechosa, etc.)
   - Click "Enviar Alerta de Seguridad"
   - Todos en la sala recibirán la alerta

#### **Flujo Completo de Prueba:**
```
1. Conectar al servidor
2. Crear sala (Alice)
3. Unirse con otro cliente (Bob)
4. Alice: Enviar clave pública (broadcast)
5. Bob: Enviar clave pública (broadcast)
6. Alice: Compartir room key con Bob
7. Ambos: Enviar mensajes cifrados
8. Probar alerts de seguridad
9. Verificar estado de sala
10. Probar indicadores de escritura
```

### Ejecutar Tests
});

socket.on('room:created', (data) => {
  console.log('Sala creada:', data);
  
  // Unirse con otro cliente
  const socket2 = io('http://localhost:3000');
  socket2.emit('room:join', {
    roomCode: data.code,
    alias: 'Tester2',
    isGhost: false
  });
});
```

## Consideraciones de Seguridad

- ✅ **Zero Knowledge**: El servidor no puede acceder al contenido de los mensajes
- ✅ **Perfect Forward Secrecy**: Cada sesión usa claves ECDH únicas
- ✅ **Temporal Storage**: Los datos se eliminan automáticamente (TTL 1 hora)
- ✅ **No Metadata Leakage**: El servidor solo sabe quién está en qué sala, no el contenido

## Desarrollo

### Scripts Disponibles
```bash
pnpm run start:dev    # Desarrollo con watch
pnpm run build        # Compilar para producción
pnpm run lint         # Linting del código
pnpm run format       # Formatear con Prettier
```

### Estructura de Proyecto
```
src/
├── app.module.ts           # Módulo raíz
├── main.ts                 # Punto de entrada
├── core/                   # Infraestructura compartida
│   ├── domain/             # Errores de dominio, VOs
│   └── infrastructure/     # Redis, configuración
├── modules/                # Módulos de negocio
│   ├── room/               # Gestión de salas
│   ├── message/            # Relay de mensajes
│   └── security/           # Utilidades de seguridad
└── app.controller.ts       # Controller HTTP básico
```

## Contribuir

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/amazing-feature`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push al branch (`git push origin feature/amazing-feature`)
5. Abrir Pull Request

## Licencia

UNLICENSED - Todos los derechos reservados

---

**Nota Importante:**
Esta API está diseñada para ser utilizada con un cliente frontend que implemente el cifrado/descifrado ECDH. El servidor solo proporciona la infraestructura de relay seguro.
