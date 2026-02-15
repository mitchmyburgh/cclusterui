# 07 - Server REST API & WebSocket Routes

## Goal

Define all REST API routes and WebSocket endpoint on the Hono server.

## Steps

### 7.1 Create chat REST routes

Create `packages/server/src/routes/chats.ts`:

#### GET /api/chats
- Query params: `limit` (default 50), `offset` (default 0)
- Calls `repo.listChats({ limit, offset })`
- Returns `{ data: Chat[], total: number }`

#### POST /api/chats
- Body: `{ title?: string }`
- Calls `repo.createChat(body)`
- Returns `{ data: Chat }` with status 201

#### GET /api/chats/:id
- Calls `repo.getChat(id)`
- Returns `{ data: Chat }` or 404

#### PATCH /api/chats/:id
- Body: `{ title?: string }`
- Calls `repo.updateChat(id, body)`
- Returns `{ data: Chat }` or 404

#### DELETE /api/chats/:id
- Calls `repo.deleteChat(id)`
- Returns 204 or 404

### 7.2 Create message REST routes

Create `packages/server/src/routes/messages.ts`:

#### GET /api/chats/:chatId/messages
- Query params: `limit` (default 50), `offset` (default 0)
- Calls `repo.getMessages(chatId, { limit, offset })`
- Returns `{ data: Message[], total: number }`

### 7.3 Create WebSocket route

Create `packages/server/src/routes/ws.ts`:

#### GET /api/chats/:id/ws (WebSocket upgrade)

Authentication:
- Extract token from `?token=<api-key>` query parameter
- Validate against config.apiKeys
- Reject with 401 if invalid

Connection setup:
- Look up chat by `id` from DB
- If chat doesn't exist, close with error
- Store WebSocket connection in a connection map keyed by chatId

Message handling (`onMessage`):
- Parse incoming JSON as `WSClientEvent`
- If `type === "send_message"`:
  1. Persist user message to DB via `repo.addMessage(chatId, "user", content)`
  2. Get chat's `sessionId` from DB
  3. Call `clientManager.sendMessage(chatId, content, sessionId, callbacks)` where callbacks:
     - `onTextDelta(delta)` -> send `{ type: "message_delta", messageId, delta }` to WS
     - `onToolUse(name, input)` -> send `{ type: "tool_use", toolName, toolInput }` to WS
     - `onStatus(status)` -> send `{ type: "status", status }` to WS
     - `onComplete(result)` -> persist assistant message to DB, update chat sessionId, send `{ type: "message_complete", message }` to WS
     - `onError(error)` -> send `{ type: "error", error }` to WS
  4. Send `{ type: "message_start", messageId }` immediately
- If `type === "cancel"`:
  1. Call `clientManager.cancelChat(chatId)`

Connection cleanup (`onClose`):
- Remove from connection map

### 7.4 Implement using Hono's upgradeWebSocket

The WebSocket route uses the `upgradeWebSocket` helper from `@hono/node-ws`:

```typescript
import { upgradeWebSocket } from "../index.js";  // exported from entry point

app.get("/api/chats/:id/ws", upgradeWebSocket((c) => {
  return {
    onOpen(evt, ws) { /* ... */ },
    onMessage(evt, ws) { /* ... */ },
    onClose(evt, ws) { /* ... */ },
    onError(evt, ws) { /* ... */ },
  };
}));
```

### 7.5 Register routes on app

In `packages/server/src/app.ts`:

```typescript
import { chatRoutes } from "./routes/chats.js";
import { messageRoutes } from "./routes/messages.js";
import { wsRoutes } from "./routes/ws.js";

app.route("/api", chatRoutes);
app.route("/api", messageRoutes);
app.route("/api", wsRoutes);
```

### 7.6 Error handling

Create `packages/server/src/middleware/error-handler.ts`:

- Global error handler middleware
- Catches thrown errors
- Returns consistent JSON error response: `{ error: string, code: string, status: number }`
- Log errors to console

## API Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /api/chats | List chats |
| POST | /api/chats | Create chat |
| GET | /api/chats/:id | Get chat |
| PATCH | /api/chats/:id | Update chat |
| DELETE | /api/chats/:id | Delete chat |
| GET | /api/chats/:id/messages | List messages |
| WS | /api/chats/:id/ws | Chat WebSocket |

## Output

- All REST routes implemented and registered
- WebSocket route with auth and message handling
- Error handling middleware
- Types flow end-to-end from shared package
