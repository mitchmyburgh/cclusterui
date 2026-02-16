# @claude-chat/shared

Shared type definitions and constants for the ccluster monorepo. This package is the single source of truth for the data contracts between the **server**, **client** (producer), **web UI**, and **TUI** packages. It contains no runtime logic -- only TypeScript interfaces, type aliases, and constant values.

## Package overview

| Field       | Value                  |
|-------------|------------------------|
| Name        | `@claude-chat/shared`  |
| Version     | `0.0.1`                |
| Module      | ESM (`"type": "module"`) |
| Entry point | `dist/index.js`        |
| Types       | `dist/index.d.ts`      |
| Test runner | Vitest                 |

## Exports

Everything is re-exported from a single barrel file (`src/index.ts`), so consumers only need one import path.

### Type modules

| Module          | Source file              | Exports                                                                                   |
|-----------------|--------------------------|-------------------------------------------------------------------------------------------|
| **chat**        | `src/types/chat.ts`      | `Chat`, `CreateChatInput`, `UpdateChatInput`                                              |
| **message**     | `src/types/message.ts`   | `MessageRole`, `MessageContent`, `Message`, `MessageMetadata`, `SendMessageInput`         |
| **ws**          | `src/types/ws.ts`        | `ToolApprovalRequest`, `ToolApprovalResponse`, `WSViewerEvent`, `WSClientEvent` (deprecated), `WSServerToViewerEvent`, `WSServerEvent` (deprecated), `WSServerToProducerEvent`, `WSProducerEvent` |
| **auth**        | `src/types/auth.ts`      | `AuthHeader`, `ApiError`, `AuthTokenPayload`                                              |
| **api**         | `src/types/api.ts`       | `ApiResponse<T>`, `ApiListResponse<T>`, `PaginationParams`                                |
| **user**        | `src/types/user.ts`      | `User`, `CreateUserInput`, `LoginInput`, `LoginResponse`, `RegisterResponse`              |
| **api-key**     | `src/types/api-key.ts`   | `ApiKey`, `CreateApiKeyInput`, `CreateApiKeyResponse`                                     |

### Constants

Defined in `src/constants.ts`:

| Constant                 | Value                                                   | Purpose                                  |
|--------------------------|---------------------------------------------------------|------------------------------------------|
| `DEFAULT_CHAT_TITLE`     | `"New Chat"`                                            | Fallback title for newly created chats   |
| `MAX_MESSAGE_LENGTH`     | `100_000`                                               | Maximum character count per message      |
| `MAX_IMAGE_SIZE`         | `10 * 1024 * 1024` (10 MB)                              | Maximum image attachment size in bytes   |
| `ALLOWED_IMAGE_TYPES`    | `["image/png", "image/jpeg", "image/gif", "image/webp"]`| Accepted MIME types for image uploads    |
| `WS_PING_INTERVAL`       | `30_000` (30 s)                                         | Interval between WebSocket ping frames   |
| `WS_HEARTBEAT_INTERVAL`  | `15_000` (15 s)                                         | Producer heartbeat send interval         |
| `WS_HEARTBEAT_TIMEOUT`   | `45_000` (45 s)                                         | Time before a silent producer is dropped |
| `DEFAULT_PAGE_SIZE`       | `50`                                                    | Default limit for paginated list queries |

## WebSocket event flow

The system uses a relay architecture. The **server** sits between two WebSocket participants: the **viewer** (web UI or TUI) and the **producer** (local client running the Claude Agent SDK).

```
  Viewer (Web UI / TUI)              Server                Producer (Local Client)
  =====================          =============            =======================
          |                            |                            |
          |  WSViewerEvent             |                            |
          |  { send_message }          |                            |
          |--------------------------->|                            |
          |                            |  WSServerToProducerEvent   |
          |                            |  { process_message }       |
          |                            |--------------------------->|
          |                            |                            |
          |                            |     WSProducerEvent        |
          |                            |     { message_start }      |
          |                            |<---------------------------|
          |  WSServerToViewerEvent     |                            |
          |  { message_start }         |                            |
          |<---------------------------|                            |
          |                            |                            |
          |                            |     WSProducerEvent        |
          |                            |     { message_delta }      |
          |                            |<---------------------------|
          |  WSServerToViewerEvent     |                            |
          |  { message_delta }         |                            |
          |<---------------------------|                            |
          |                            |                            |
          |                            |     WSProducerEvent        |
          |                            |     { message_complete }   |
          |                            |<---------------------------|
          |  WSServerToViewerEvent     |                            |
          |  { message_complete }      |                            |
          |<---------------------------|                            |
          |                            |                            |

  ── Tool approval (human-in-the-loop) ────────────────────────────

          |                            |     WSProducerEvent        |
          |                            |  { tool_approval_request } |
          |                            |<---------------------------|
          |  WSServerToViewerEvent     |                            |
          |  { tool_approval_request } |                            |
          |<---------------------------|                            |
          |                            |                            |
          |  WSViewerEvent             |                            |
          | { tool_approval_response } |                            |
          |--------------------------->|                            |
          |                            | WSServerToProducerEvent    |
          |                            | { tool_approval_response } |
          |                            |--------------------------->|
          |                            |                            |

  ── Cancellation ─────────────────────────────────────────────────

          |  WSViewerEvent             |                            |
          |  { cancel }               |                            |
          |--------------------------->|                            |
          |                            |  WSServerToProducerEvent   |
          |                            |  { cancel }               |
          |                            |--------------------------->|
          |                            |                            |

  ── Heartbeat (producer keep-alive) ──────────────────────────────

          |                            |     WSProducerEvent        |
          |                            |     { heartbeat }          |
          |                            |<---------------------------|
          |                            |                            |
```

### Event direction summary

| Direction            | Type union                 | Event types                                                                                                 |
|----------------------|----------------------------|-------------------------------------------------------------------------------------------------------------|
| Viewer --> Server    | `WSViewerEvent`            | `send_message`, `cancel`, `tool_approval_response`                                                         |
| Server --> Viewer    | `WSServerToViewerEvent`    | `message_start`, `message_delta`, `message_complete`, `tool_use`, `error`, `status`, `producer_status`, `user_message_stored`, `tool_approval_request` |
| Server --> Producer  | `WSServerToProducerEvent`  | `process_message`, `cancel`, `tool_approval_response`                                                      |
| Producer --> Server  | `WSProducerEvent`          | `message_start`, `message_delta`, `message_complete`, `tool_use`, `status`, `error`, `heartbeat`, `tool_approval_request` |

## Type reference

### Chat

```typescript
interface Chat {
  id: string;
  title: string;
  sessionId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateChatInput {
  title?: string;
  userId?: string;
}

interface UpdateChatInput {
  title?: string;
}
```

### Message

```typescript
type MessageRole = "user" | "assistant";

interface MessageContent {
  type: "text" | "image";
  text?: string;
  imageData?: string;
  mimeType?: string;
}

interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: MessageContent[];
  createdAt: string;
  metadata?: MessageMetadata;
}

interface MessageMetadata {
  totalCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  model?: string;
}

interface SendMessageInput {
  content: MessageContent[];
}
```

### WebSocket -- Tool approval

```typescript
interface ToolApprovalRequest {
  requestId: string;
  toolName: string;
  toolInput: unknown;
}

interface ToolApprovalResponse {
  requestId: string;
  approved: boolean;
  alwaysAllow?: boolean;
  message?: string;
}
```

### Auth

```typescript
interface AuthHeader {
  authorization: string;
}

interface ApiError {
  error: string;
  code: string;
  status: number;
}

interface AuthTokenPayload {
  userId: string;
  username: string;
  type: "jwt" | "api_key" | "legacy";
}
```

### API response wrappers

```typescript
interface ApiResponse<T> {
  data: T;
}

interface ApiListResponse<T> {
  data: T[];
  total: number;
}

interface PaginationParams {
  limit?: number;
  offset?: number;
}
```

### User

```typescript
interface User {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateUserInput {
  username: string;
  password: string;
}

interface LoginInput {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

interface RegisterResponse {
  token: string;
  user: User;
}
```

### API key

```typescript
interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface CreateApiKeyInput {
  name: string;
}

interface CreateApiKeyResponse {
  apiKey: ApiKey;
  rawKey: string;
}
```

## Usage examples

### Importing types in a sibling package

```typescript
import type {
  Chat,
  Message,
  MessageContent,
  WSViewerEvent,
  WSServerToViewerEvent,
  WSProducerEvent,
  WSServerToProducerEvent,
  ApiResponse,
  ApiListResponse,
} from "@claude-chat/shared";

// Fetch a paginated list of chats
async function fetchChats(token: string): Promise<ApiListResponse<Chat>> {
  const res = await fetch("/api/chats", {
    headers: { authorization: `Bearer ${token}` },
  });
  return res.json();
}
```

### Using constants

```typescript
import {
  MAX_MESSAGE_LENGTH,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  DEFAULT_CHAT_TITLE,
  WS_HEARTBEAT_INTERVAL,
} from "@claude-chat/shared";

function validateMessage(text: string): boolean {
  return text.length <= MAX_MESSAGE_LENGTH;
}

function validateImage(file: File): boolean {
  return (
    ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE
  );
}
```

### Typing a WebSocket handler

```typescript
import type {
  WSServerToViewerEvent,
  WSViewerEvent,
} from "@claude-chat/shared";

function handleServerEvent(event: WSServerToViewerEvent) {
  switch (event.type) {
    case "message_start":
      console.log("New message:", event.messageId);
      break;
    case "message_delta":
      appendToUI(event.delta);
      break;
    case "message_complete":
      finalizeMessage(event.message);
      break;
    case "tool_approval_request":
      showApprovalDialog(event.request);
      break;
    case "producer_status":
      updateConnectionBadge(event.connected);
      break;
    case "error":
      showError(event.error);
      break;
  }
}
```

## Building

```bash
# From the monorepo root
npm run build --workspace=packages/shared

# Or from this directory
npm run build

# Watch mode for development
npm run dev
```

## Deprecated exports

The following aliases are kept for backward compatibility and will be removed in a future release:

| Deprecated name   | Replacement              |
|-------------------|--------------------------|
| `WSClientEvent`   | `WSViewerEvent`          |
| `WSServerEvent`   | `WSServerToViewerEvent`  |
