# 02 - Shared TypeScript Types

## Goal

Create the `@claude-chat/shared` package with all TypeScript types, constants, and validation schemas shared across packages.

## Steps

### 2.1 Define Chat types

Create `packages/shared/src/types/chat.ts`:

```typescript
export interface Chat {
  id: string;           // UUID
  title: string;
  sessionId: string | null;  // Claude Agent SDK session ID
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}

export interface CreateChatInput {
  title?: string;       // optional, defaults to "New Chat"
}

export interface UpdateChatInput {
  title?: string;
}
```

### 2.2 Define Message types

Create `packages/shared/src/types/message.ts`:

```typescript
export type MessageRole = "user" | "assistant";

export interface MessageContent {
  type: "text" | "image";
  text?: string;
  // For images: base64 data URI
  imageData?: string;
  mimeType?: string;
}

export interface Message {
  id: string;           // UUID
  chatId: string;       // FK to Chat
  role: MessageRole;
  content: MessageContent[];
  createdAt: string;    // ISO 8601
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  totalCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  model?: string;
}

export interface SendMessageInput {
  content: MessageContent[];
}
```

### 2.3 Define WebSocket event types

Create `packages/shared/src/types/ws.ts`:

```typescript
// Client -> Server
export type WSClientEvent =
  | { type: "send_message"; content: MessageContent[] }
  | { type: "cancel" };

// Server -> Client
export type WSServerEvent =
  | { type: "message_start"; messageId: string }
  | { type: "message_delta"; messageId: string; delta: string }
  | { type: "message_complete"; message: Message }
  | { type: "tool_use"; toolName: string; toolInput: unknown }
  | { type: "error"; error: string; code?: string }
  | { type: "status"; status: "thinking" | "tool_use" | "responding" | "idle" };
```

### 2.4 Define Auth types

Create `packages/shared/src/types/auth.ts`:

```typescript
export interface AuthHeader {
  authorization: string;  // "Bearer <api-key>"
}

export interface ApiError {
  error: string;
  code: string;
  status: number;
}
```

### 2.5 Define API response wrapper

Create `packages/shared/src/types/api.ts`:

```typescript
export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  total: number;
}

export interface PaginationParams {
  limit?: number;   // default 50
  offset?: number;  // default 0
}
```

### 2.6 Define constants

Create `packages/shared/src/constants.ts`:

```typescript
export const DEFAULT_CHAT_TITLE = "New Chat";
export const MAX_MESSAGE_LENGTH = 100_000;  // characters
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const WS_PING_INTERVAL = 30_000;  // 30 seconds
export const DEFAULT_PAGE_SIZE = 50;
```

### 2.7 Create barrel export

Create `packages/shared/src/index.ts`:

```typescript
export * from "./types/chat.js";
export * from "./types/message.js";
export * from "./types/ws.js";
export * from "./types/auth.js";
export * from "./types/api.js";
export * from "./constants.js";
```

### 2.8 Build and verify

```bash
cd packages/shared && pnpm build
```

Verify that `dist/` contains compiled JS + `.d.ts` files.

## Output

- All shared types defined and exported
- Package builds cleanly
- Ready to be consumed by other packages via `@claude-chat/shared`
