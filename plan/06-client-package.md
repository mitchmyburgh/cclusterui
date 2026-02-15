# 06 - Claude Agent SDK Client Wrapper

## Goal

Create `@claude-chat/client` package that wraps the Claude Agent SDK, manages sessions, streams responses, and handles images.

## Steps

### 6.1 Install dependencies

```bash
cd packages/client
pnpm add @anthropic-ai/claude-agent-sdk
pnpm add @claude-chat/shared@workspace:*
```

### 6.2 Create .claude directory

Create `packages/client/.claude/` directory. This is where the Agent SDK stores session data, settings, and project context.

Create `packages/client/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [],
    "deny": []
  }
}
```

### 6.3 Create client manager

Create `packages/client/src/client-manager.ts`:

This is the main class that manages multiple concurrent Claude sessions.

```typescript
import { query, type Query } from "@anthropic-ai/claude-agent-sdk";
import type { MessageContent } from "@claude-chat/shared";

export interface ClientSession {
  sessionId: string | null;
  query: Query | null;
  abortController: AbortController;
}

export interface StreamCallbacks {
  onTextDelta: (delta: string) => void;
  onToolUse: (toolName: string, toolInput: unknown) => void;
  onComplete: (result: { text: string; sessionId: string; costUsd: number; inputTokens: number; outputTokens: number; durationMs: number }) => void;
  onError: (error: string) => void;
  onStatus: (status: "thinking" | "tool_use" | "responding") => void;
}

export class ClientManager {
  private sessions: Map<string, ClientSession> = new Map();
  private anthropicApiKey: string;
  private cwd: string;

  constructor(config: { anthropicApiKey: string; cwd: string }) {
    this.anthropicApiKey = config.anthropicApiKey;
    this.cwd = config.cwd;
  }

  // Methods defined in subsequent steps
}
```

### 6.4 Implement sendMessage method

Add to `ClientManager`:

```typescript
async sendMessage(
  chatId: string,
  content: MessageContent[],
  existingSessionId: string | null,
  callbacks: StreamCallbacks
): Promise<void>
```

Implementation:
1. Build prompt string from `content` array (text parts concatenated)
2. Build image content blocks for multimodal messages
3. Create `AbortController` for cancellation
4. Call `query()` with:
   - `prompt`: the constructed prompt (or `SDKUserMessage` with image blocks)
   - `options.resume`: `existingSessionId` if resuming
   - `options.abortController`: for cancellation
   - `options.permissionMode`: `"bypassPermissions"` (server-side, no interactive prompts)
   - `options.allowedTools`: `["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch"]`
   - `options.cwd`: this.cwd
   - `options.env`: `{ ANTHROPIC_API_KEY: this.anthropicApiKey }`
   - `options.includePartialMessages`: `true` (for streaming deltas)
   - `options.settingSources`: `["project"]` (to load .claude dir)
5. Iterate over async generator messages:
   - `type === "system" && subtype === "init"`: capture `session_id`, store in sessions map
   - `type === "stream_event"`: extract text deltas from `event`, call `callbacks.onTextDelta(delta)`
   - `type === "assistant"`: check for tool_use blocks, call `callbacks.onToolUse(name, input)`
   - `type === "result" && subtype === "success"`: call `callbacks.onComplete(...)` with result data
   - `type === "result" && subtype starts with "error"`: call `callbacks.onError(...)`
6. Store session in `this.sessions` map keyed by `chatId`

### 6.5 Handle multimodal messages (images)

When `content` contains image items:
- The Agent SDK `query()` accepts `prompt` as `string | AsyncIterable<SDKUserMessage>`
- For images, use the `AsyncIterable<SDKUserMessage>` form
- Construct an `SDKUserMessage` with content blocks:
  ```typescript
  {
    type: "user",
    session_id: "",
    parent_tool_use_id: null,
    message: {
      role: "user",
      content: [
        { type: "text", text: "user's text message" },
        { type: "image", source: { type: "base64", media_type: mimeType, data: base64Data } }
      ]
    }
  }
  ```
- Wrap in an async generator that yields this single message

### 6.6 Implement cancel method

```typescript
cancelChat(chatId: string): void {
  const session = this.sessions.get(chatId);
  if (session) {
    session.abortController.abort();
  }
}
```

### 6.7 Implement cleanup

```typescript
async destroy(): Promise<void> {
  for (const [, session] of this.sessions) {
    session.abortController.abort();
  }
  this.sessions.clear();
}
```

### 6.8 Create barrel export

Create `packages/client/src/index.ts`:

```typescript
export { ClientManager } from "./client-manager.js";
export type { ClientSession, StreamCallbacks } from "./client-manager.js";
```

### 6.9 Build and verify

```bash
cd packages/client && pnpm build
```

## Notes on the Agent SDK

Key details from the SDK docs:
- `query()` returns `AsyncGenerator<SDKMessage, void>` - we iterate to stream
- `includePartialMessages: true` gives us `stream_event` messages with `RawMessageStreamEvent` from the Anthropic SDK
- `resume: sessionId` continues an existing conversation
- `abortController` allows cancellation
- Session IDs come from the `system` init message
- Results include `total_cost_usd`, `usage`, and `duration_ms`
- The SDK runs as a subprocess - we need `cwd` pointed at the client package so it picks up `.claude/`

## Output

- `ClientManager` class that manages multiple concurrent Claude sessions
- Streaming support with text deltas, tool use notifications, and completion
- Image/multimodal message support
- Session resumption for conversation continuity
- Cancellation support
