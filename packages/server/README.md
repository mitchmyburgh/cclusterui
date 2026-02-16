# @ccluster/server

Hono-based HTTP and WebSocket server that powers the ccluster platform. It exposes a REST API for authentication, chat management, message retrieval, and API key administration, alongside a WebSocket layer that bridges **viewer** clients (web UI) and **producer** clients (local Claude agents) in real time.

The server listens on port 3000 by default and serves the static UI bundle in production mode.

## Table of Contents

- [Architecture](#architecture)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [REST API Reference](#rest-api-reference)
  - [Health Check](#health-check)
  - [Auth Routes (Public)](#auth-routes-public)
  - [Chat Routes (Protected)](#chat-routes-protected)
  - [Message Routes (Protected)](#message-routes-protected)
  - [API Key Routes (Protected)](#api-key-routes-protected)
  - [Producer Status (Protected)](#producer-status-protected)
- [WebSocket Protocol](#websocket-protocol)
  - [Connection Endpoint](#connection-endpoint)
  - [Viewer Events](#viewer-events)
  - [Server-to-Viewer Events](#server-to-viewer-events)
  - [Producer Events](#producer-events)
  - [Server-to-Producer Events](#server-to-producer-events)
  - [Tool Approval Relay](#tool-approval-relay)
  - [Heartbeat and Timeouts](#heartbeat-and-timeouts)
- [ConnectionManager](#connectionmanager)
- [Error Handling](#error-handling)
- [Development](#development)
- [Project Structure](#project-structure)

## Architecture

```
Viewer (Web UI)                Server (:3000)              Producer (Local Client)
     |                             |                             |
     |--- REST: auth, chats, ----->|                             |
     |    messages, keys           |                             |
     |                             |                             |
     |<== WS: /api/chats/:id/ws ==|== WS: /api/chats/:id/ws ==>|
     |    role=viewer              |    role=producer             |
     |                             |                             |
     |-- send_message ------------>|-- process_message --------->|
     |                             |                             |
     |<-- message_delta -----------|<-- message_delta ---------- |
     |<-- message_complete --------|<-- message_complete --------|
     |                             |                             |
     |<-- tool_approval_request ---|<-- tool_approval_request ---|
     |-- tool_approval_response -->|-- tool_approval_response -->|
```

The server acts as a relay between viewers and producers. Viewers submit messages, the server persists them, and forwards processing requests to the connected producer. The producer streams responses back, which the server persists and broadcasts to all viewers watching that chat.

## Configuration

All configuration is loaded from environment variables (via `dotenv`). See `src/config.ts` for the full `ServerConfig` interface.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `JWT_SECRET` | _(none)_ | Secret for signing/verifying HS256 JWTs. If unset, JWT auth is disabled and a warning is logged. |
| `API_KEYS` | _(none)_ | Comma-separated list of legacy API keys for backward-compatible auth |
| `ALLOWED_USERNAMES` | _(none)_ | Comma-separated list of usernames permitted to register. If empty, registration is disabled. |
| `DB_DRIVER` | `sqlite` | Database driver: `sqlite`, `postgres`, `mysql`, or `mongodb` |
| `SQLITE_PATH` | `./data/claude-chat.db` | Path to the SQLite database file |
| `POSTGRES_URL` | _(none)_ | PostgreSQL connection URL |
| `MYSQL_URL` | _(none)_ | MySQL connection URL |
| `MONGODB_URL` | _(none)_ | MongoDB connection URL |
| `MONGODB_NAME` | _(none)_ | MongoDB database name |
| `NODE_ENV` | _(none)_ | Set to `production` to serve static UI files from `./packages/ui/dist` |

Example `.env` file:

```env
PORT=3000
HOST=0.0.0.0
JWT_SECRET=your-secret-key-here
ALLOWED_USERNAMES=alice,bob
DB_DRIVER=sqlite
SQLITE_PATH=./data/claude-chat.db
```

## Authentication

The auth middleware (`src/middleware/auth.ts`) evaluates tokens in the following order:

1. **JWT** -- A `Bearer <token>` in the `Authorization` header (or `?token=` query parameter for WebSocket connections) is verified against `JWT_SECRET` using HS256. The payload must contain `userId` and `username`. Tokens expire after 30 days.

2. **API Key** -- Tokens prefixed with `cck_` are SHA-256 hashed and looked up in the database. If a matching active key is found, the associated user's identity is used. The key's `lastUsedAt` timestamp is updated asynchronously.

3. **Legacy API Key** -- The raw token is compared against the `API_KEYS` environment variable list. Matching tokens authenticate as user `system`.

If none of these methods succeed, a `401 Unauthorized` response is returned.

**Public routes** (`/health`, `/api/auth/register`, `/api/auth/login`) bypass authentication entirely.

## REST API Reference

All API routes are prefixed with `/api`. Protected routes require a valid token.

### Response Format

Successful responses follow this structure:

```json
{ "data": <payload> }
```

List responses include a total count:

```json
{ "data": [...], "total": 42 }
```

Error responses:

```json
{ "error": "Description", "code": "ERROR_CODE", "status": 400 }
```

### Health Check

#### `GET /health`

No authentication required.

**Response:**
```json
{ "status": "ok" }
```

---

### Auth Routes (Public)

These routes do not require authentication. They require `JWT_SECRET` to be configured.

#### `POST /api/auth/register`

Register a new user. The username must appear in the `ALLOWED_USERNAMES` list.

**Request Body:**
```json
{
  "username": "alice",
  "password": "secret"
}
```

**Response (201):**
```json
{
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "username": "alice",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Codes:**
- `JWT_NOT_CONFIGURED` (500) -- `JWT_SECRET` is not set
- `INVALID_INPUT` (400) -- Missing username or password
- `REGISTRATION_DISABLED` (403) -- `ALLOWED_USERNAMES` is empty
- `USERNAME_NOT_ALLOWED` (403) -- Username not in the allowed list
- `USERNAME_TAKEN` (409) -- Username already exists

#### `POST /api/auth/login`

Authenticate an existing user and receive a JWT.

**Request Body:**
```json
{
  "username": "alice",
  "password": "secret"
}
```

**Response (200):**
```json
{
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "username": "alice",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Codes:**
- `JWT_NOT_CONFIGURED` (500) -- `JWT_SECRET` is not set
- `INVALID_INPUT` (400) -- Missing username or password
- `INVALID_CREDENTIALS` (401) -- Username not found or password mismatch

---

### Chat Routes (Protected)

#### `GET /api/chats`

List chats for the authenticated user.

**Query Parameters:**
| Parameter | Default | Description |
|---|---|---|
| `limit` | `50` | Maximum number of chats to return |
| `offset` | `0` | Number of chats to skip |

**Response (200):**
```json
{
  "data": [
    {
      "id": "chat-uuid",
      "title": "My Chat",
      "sessionId": "session-uuid",
      "userId": "user-uuid",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

#### `POST /api/chats`

Create a new chat.

**Request Body:**
```json
{
  "title": "My Chat"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "chat-uuid",
    "title": "My Chat",
    "sessionId": null,
    "userId": "user-uuid",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

#### `GET /api/chats/:id`

Get a single chat by ID. Only the owning user can access it.

**Response (200):**
```json
{
  "data": {
    "id": "chat-uuid",
    "title": "My Chat",
    "sessionId": "session-uuid",
    "userId": "user-uuid",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Error Codes:**
- `NOT_FOUND` (404) -- Chat does not exist or belongs to a different user

#### `PATCH /api/chats/:id`

Update a chat (e.g., rename it).

**Request Body:**
```json
{
  "title": "Renamed Chat"
}
```

**Response (200):** Updated chat object.

**Error Codes:**
- `NOT_FOUND` (404) -- Chat does not exist or belongs to a different user

#### `DELETE /api/chats/:id`

Delete a chat and its messages.

**Response:** `204 No Content`

**Error Codes:**
- `NOT_FOUND` (404) -- Chat does not exist or belongs to a different user

---

### Message Routes (Protected)

#### `GET /api/chats/:chatId/messages`

List messages in a chat. Requires ownership of the chat.

**Query Parameters:**
| Parameter | Default | Description |
|---|---|---|
| `limit` | `50` | Maximum number of messages to return |
| `offset` | `0` | Number of messages to skip |

**Response (200):**
```json
{
  "data": [
    {
      "id": "msg-uuid",
      "chatId": "chat-uuid",
      "role": "user",
      "content": [{ "type": "text", "text": "Hello" }],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "metadata": null
    }
  ],
  "total": 1
}
```

**Error Codes:**
- `NOT_FOUND` (404) -- Chat does not exist or belongs to a different user

---

### API Key Routes (Protected)

API keys provide an alternative authentication method. Keys are prefixed with `cck_` and stored as SHA-256 hashes.

#### `POST /api/keys`

Generate a new API key for the authenticated user.

**Request Body:**
```json
{
  "name": "My CLI Key"
}
```

**Response (201):**
```json
{
  "data": {
    "apiKey": {
      "id": "key-uuid",
      "userId": "user-uuid",
      "name": "My CLI Key",
      "keyPrefix": "cck_abcdef01",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastUsedAt": null,
      "revokedAt": null
    },
    "rawKey": "cck_abcdef0123456789abcdef0123456789"
  }
}
```

The `rawKey` is returned only once at creation time. Store it securely.

#### `GET /api/keys`

List all API keys for the authenticated user (raw keys are never returned).

**Response (200):**
```json
{
  "data": [
    {
      "id": "key-uuid",
      "userId": "user-uuid",
      "name": "My CLI Key",
      "keyPrefix": "cck_abcdef01",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastUsedAt": "2025-01-02T00:00:00.000Z",
      "revokedAt": null
    }
  ]
}
```

#### `DELETE /api/keys/:id`

Revoke an API key. Revoked keys can no longer authenticate.

**Response:** `204 No Content`

**Error Codes:**
- `NOT_FOUND` (404) -- Key does not exist or belongs to a different user

---

### Producer Status (Protected)

#### `GET /api/chats/:id/producer-status`

Check whether a producer (local Claude agent) is currently connected to a chat's WebSocket.

**Response (200):**
```json
{
  "connected": true,
  "hostname": "workstation",
  "cwd": "/home/user/project",
  "connectedAt": "2025-01-01T00:00:00.000Z",
  "hitl": true
}
```

Or when no producer is connected:

```json
{
  "connected": false
}
```

**Error Codes:**
- `NOT_FOUND` (404) -- Chat does not exist or belongs to a different user

---

## WebSocket Protocol

### Connection Endpoint

```
GET /api/chats/:id/ws?role=<viewer|producer>&token=<auth-token>
```

The `role` query parameter determines the connection type. Authentication is handled via the `token` query parameter (same tokens accepted as the REST API).

**Producer-specific query parameters:**
| Parameter | Description |
|---|---|
| `hostname` | Machine hostname of the producer |
| `cwd` | Current working directory of the producer |
| `hitl` | `"true"` if the producer is running in human-in-the-loop mode |

On connection open, the server verifies that the chat exists and belongs to the authenticated user. If validation fails, an error event is sent and the connection is closed immediately.

Only one producer may be connected to a chat at a time. A second producer attempting to connect receives a `PRODUCER_EXISTS` error and is disconnected.

All WebSocket messages are JSON-encoded strings.

---

### Viewer Events

Events sent **from the viewer to the server**.

#### `send_message`

Submit a new user message to the chat.

```json
{
  "type": "send_message",
  "content": [
    { "type": "text", "text": "Explain this code" }
  ]
}
```

The server persists the message, broadcasts a `user_message_stored` event to all viewers, then sends a `process_message` command to the connected producer. If no producer is connected, an error event with code `NO_PRODUCER` is returned.

#### `tool_approval_response`

Respond to a tool approval request from the producer.

```json
{
  "type": "tool_approval_response",
  "response": {
    "requestId": "req-uuid",
    "approved": true,
    "alwaysAllow": false,
    "message": "Looks good"
  }
}
```

#### `cancel`

Cancel the current operation on the producer.

```json
{
  "type": "cancel"
}
```

---

### Server-to-Viewer Events

Events sent **from the server to viewer clients**.

#### `producer_status`

Sent when a viewer connects (with current status) and whenever a producer connects or disconnects.

```json
{
  "type": "producer_status",
  "connected": true,
  "hostname": "workstation",
  "cwd": "/home/user/project",
  "connectedAt": "2025-01-01T00:00:00.000Z",
  "hitl": true
}
```

#### `user_message_stored`

Confirms a user message has been persisted.

```json
{
  "type": "user_message_stored",
  "message": { "id": "msg-uuid", "chatId": "...", "role": "user", "content": [...], "createdAt": "..." }
}
```

#### `message_start`

The producer has begun generating a response.

```json
{ "type": "message_start", "messageId": "msg-uuid" }
```

#### `message_delta`

A streaming text chunk from the producer.

```json
{ "type": "message_delta", "messageId": "msg-uuid", "delta": "Here is the" }
```

#### `message_complete`

The final persisted assistant message, including metadata (cost, tokens, duration, model).

```json
{
  "type": "message_complete",
  "message": {
    "id": "msg-uuid",
    "chatId": "chat-uuid",
    "role": "assistant",
    "content": [{ "type": "text", "text": "Full response..." }],
    "createdAt": "...",
    "metadata": {
      "totalCostUsd": 0.003,
      "inputTokens": 150,
      "outputTokens": 200,
      "durationMs": 2500,
      "model": "claude-sonnet-4-20250514"
    }
  }
}
```

#### `tool_use`

The producer is invoking a tool.

```json
{ "type": "tool_use", "toolName": "read_file", "toolInput": { "path": "/etc/hosts" } }
```

#### `tool_approval_request`

The producer requests human approval before executing a tool (when running in HITL mode).

```json
{
  "type": "tool_approval_request",
  "request": {
    "requestId": "req-uuid",
    "toolName": "write_file",
    "toolInput": { "path": "/tmp/output.txt", "content": "..." }
  }
}
```

#### `status`

Indicates the producer's current processing state.

```json
{ "type": "status", "status": "thinking" }
```

Possible values: `thinking`, `tool_use`, `responding`, `idle`.

#### `error`

An error occurred.

```json
{ "type": "error", "error": "No local client connected.", "code": "NO_PRODUCER" }
```

---

### Producer Events

Events sent **from the producer to the server**.

| Event Type | Description |
|---|---|
| `heartbeat` | Keep-alive signal, must be sent at least every 45 seconds |
| `message_start` | Signals the beginning of a new assistant response |
| `message_delta` | Streaming text chunk |
| `message_complete` | Final message with content and optional `sessionId`; the server persists this to the database |
| `tool_use` | Notification that a tool is being invoked |
| `tool_approval_request` | Requests viewer approval for a tool execution |
| `status` | Current processing state update |
| `error` | Reports an error to viewers |

The `message_complete` event is special: the server extracts the message content and metadata, persists it to the database via `repo.addMessage()`, updates the chat's `sessionId` if provided, and auto-titles untitled chats from the first response text.

---

### Server-to-Producer Events

Events sent **from the server to the producer**.

#### `process_message`

Instructs the producer to process a user message.

```json
{
  "type": "process_message",
  "chatId": "chat-uuid",
  "content": [{ "type": "text", "text": "User's question" }],
  "sessionId": "session-uuid-or-null",
  "messageHistory": [...]
}
```

#### `tool_approval_response`

Relays the viewer's tool approval decision.

```json
{
  "type": "tool_approval_response",
  "response": {
    "requestId": "req-uuid",
    "approved": true,
    "alwaysAllow": false
  }
}
```

#### `cancel`

Requests the producer to abort the current operation.

```json
{ "type": "cancel" }
```

---

### Tool Approval Relay

When a producer operates in human-in-the-loop (HITL) mode, the full approval flow is:

1. Producer sends `tool_approval_request` to the server
2. Server relays the request to all connected viewers
3. A viewer sends `tool_approval_response` back to the server
4. Server relays the response to the producer
5. Producer proceeds or aborts based on the `approved` field

---

### Heartbeat and Timeouts

- Producers must send `{ "type": "heartbeat" }` messages periodically
- The server checks for stale producers every **15 seconds**
- If a producer has not sent a heartbeat within **45 seconds** (`WS_HEARTBEAT_TIMEOUT`), it is disconnected and a `producer_status { connected: false }` event is broadcast to viewers
- The recommended heartbeat interval is **15 seconds** (`WS_HEARTBEAT_INTERVAL`)

## ConnectionManager

The `ConnectionManager` class (`src/connection-manager.ts`) manages the lifecycle of all WebSocket connections. It is instantiated once at server startup and shared across all routes via the Hono context.

Key responsibilities:

- **Producer registry** -- Maintains a `Map<chatId, ProducerConnection>` ensuring at most one producer per chat. Tracks hostname, cwd, HITL mode, connection time, and last heartbeat timestamp.
- **Viewer registry** -- Maintains a `Map<chatId, ViewerConnection[]>` allowing multiple viewers per chat.
- **Message routing** -- `broadcastToViewers()` sends events to all viewers of a chat; `sendToProducer()` sends events to a specific chat's producer.
- **Heartbeat monitoring** -- A 15-second interval timer checks producer heartbeats and disconnects stale connections.
- **Graceful shutdown** -- The `destroy()` method clears the heartbeat timer and closes all open WebSocket connections.

## Error Handling

The server has a global error handler that catches unhandled exceptions and returns:

```json
{ "error": "Error message", "code": "INTERNAL_ERROR", "status": 500 }
```

WebSocket send operations are wrapped in try/catch blocks (`safeSend`) to silently handle connections that have already closed.

## Development

### Prerequisites

- Node.js (with ESM support)
- A configured `.env` file at the repository root (or environment variables set directly)

### Commands

```bash
# Start dev server with hot reload (via tsx)
npm run dev

# Type-check without emitting
npm run typecheck

# Build TypeScript to dist/
npm run build

# Start production server from compiled output
npm run start

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

### CORS

In development, the server allows CORS from `http://localhost:5173` (the default Vite dev server origin). Allowed methods are `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`. Allowed headers are `Content-Type` and `Authorization`.

### Static File Serving

When `NODE_ENV=production`, the server serves the built UI from `./packages/ui/dist` as a catch-all route. In development, the UI is expected to run on its own dev server and proxy API requests.

## Project Structure

```
src/
  index.ts                 # Entry point: creates server, injects WebSocket, handles shutdown
  app.ts                   # Hono app factory: middleware, route mounting, error handler
  config.ts                # Environment variable loading and ServerConfig interface
  context.ts               # AppContext: initializes repository, ConnectionManager, config
  connection-manager.ts    # WebSocket connection lifecycle and message routing
  types.ts                 # AppEnv type (Hono context variables)
  middleware/
    auth.ts                # JWT / API key / legacy token authentication middleware
  routes/
    auth.ts                # POST /auth/register, POST /auth/login
    chats.ts               # CRUD for chats
    messages.ts            # GET messages for a chat
    keys.ts                # API key creation, listing, revocation
    producer-status.ts     # GET producer connection status for a chat
    ws.ts                  # WebSocket upgrade handler for viewer and producer roles
  __tests__/
    auth.test.ts           # Auth middleware unit tests
```

### Dependencies

| Package | Purpose |
|---|---|
| `hono` | HTTP framework |
| `@hono/node-server` | Node.js adapter for Hono |
| `@hono/node-ws` | WebSocket support for Hono on Node.js |
| `jose` | JWT signing and verification (HS256) |
| `bcryptjs` | Password hashing for user registration/login |
| `dotenv` | Environment variable loading |
| `@ccluster/db` | Database repository abstraction (workspace dependency) |
| `@ccluster/shared` | Shared types and constants (workspace dependency) |
