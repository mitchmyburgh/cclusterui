# 12 - Chat Panel with Message Rendering

## Goal

Build the chat panel that shows messages, handles streaming responses, and displays tool usage indicators.

## Steps

### 12.1 Create useWebSocket hook

Create `packages/ui/src/hooks/useWebSocket.ts`:

```typescript
// Manages a single WebSocket connection for a chat
// State:
//   connected: boolean
//   error: string | null

// Constructor args: chatId, apiKey
// On init: connect to ws://host/api/chats/:chatId/ws?token=<apiKey>
// Handle reconnection with exponential backoff (1s, 2s, 4s, max 30s)
// Ping/pong for keepalive
// Parse incoming JSON as WSServerEvent
// Provides:
//   send(event: WSClientEvent): void
//   close(): void
//   onEvent callback registration
// Cleanup on unmount: close WebSocket
```

### 12.2 Create useChat hook

Create `packages/ui/src/hooks/useChat.ts`:

```typescript
// Manages state for a single open chat
// Args: chatId, apiKey

// State:
//   messages: Message[]
//   streamingMessage: { id: string; content: string } | null
//   status: "idle" | "thinking" | "tool_use" | "responding"
//   toolUse: { name: string; input: unknown } | null
//   loading: boolean

// On mount:
//   1. Fetch existing messages: GET /api/chats/:chatId/messages
//   2. Open WebSocket via useWebSocket

// WebSocket event handling:
//   "message_start" -> set streamingMessage = { id, content: "" }, status = "responding"
//   "message_delta" -> append delta to streamingMessage.content
//   "message_complete" -> add to messages array, clear streamingMessage, status = "idle"
//   "tool_use" -> set toolUse, status = "tool_use"
//   "status" -> update status
//   "error" -> set error state

// Provides:
//   sendMessage(content: MessageContent[]): void -> send via WS
//   cancelResponse(): void -> send cancel via WS
//   messages, streamingMessage, status, loading, error
```

### 12.3 Create ChatPanel component

Create `packages/ui/src/components/chat/ChatPanel.tsx`:

Layout:
```
┌──────────────────────────────────┐
│  Header (chat title, close btn)  │
├──────────────────────────────────┤
│                                  │
│  Messages area (scrollable)      │
│                                  │
│  [MessageBubble]                 │
│  [MessageBubble]                 │
│  [MessageBubble]                 │
│  [StreamingMessage]              │
│  [StatusIndicator]               │
│                                  │
├──────────────────────────────────┤
│  ChatInput                       │
└──────────────────────────────────┘
```

Props:
```typescript
interface ChatPanelProps {
  chatId: string;
  apiKey: string;
  onClose: () => void;    // close this panel
}
```

Behavior:
- Auto-scroll to bottom on new messages
- Show scroll-to-bottom button when scrolled up
- Loading skeleton while fetching history
- Empty state: "Send a message to start the conversation"

### 12.4 Create MessageBubble component

Create `packages/ui/src/components/chat/MessageBubble.tsx`:

- User messages: right-aligned, colored background (e.g., blue-600)
- Assistant messages: left-aligned, gray background
- Render text content with basic markdown (bold, italic, code blocks, links)
- Render images inline (if content contains image type)
- Show timestamp on hover
- Show metadata on hover (tokens, cost) for assistant messages
- Code blocks with syntax highlighting (use a lightweight lib or plain `<pre>`)
- Copy button on code blocks

Props:
```typescript
interface MessageBubbleProps {
  message: Message;
}
```

### 12.5 Create streaming message display

When `streamingMessage` is set:
- Show a MessageBubble-like component for the streaming response
- Content updates in real-time as deltas arrive
- Cursor/typing indicator at end
- Cancel button visible during streaming

### 12.6 Create status indicator

Show status below messages during active response:
- "Thinking..." with animated dots
- "Using tool: [name]" with tool icon
- "Responding..." with typing animation

### 12.7 Create markdown renderer

Create `packages/ui/src/lib/markdown.ts`:

- Simple markdown-to-HTML converter for chat messages
- Support: **bold**, *italic*, `inline code`, ```code blocks```, [links](url), lists
- Sanitize HTML to prevent XSS
- Use a lightweight library (e.g., `marked` + `DOMPurify`) or build minimal parser

### 12.8 Auto-scroll behavior

```typescript
// Ref to messages container
// After each message update:
//   - If user was at bottom (within 100px), auto-scroll to bottom
//   - If user had scrolled up, don't auto-scroll (show "scroll to bottom" button)
// On "scroll to bottom" click: smooth scroll to bottom
```

### 12.9 Handle connection errors

- If WebSocket disconnects, show banner: "Disconnected. Reconnecting..."
- On reconnect, refetch messages to ensure consistency
- If reconnect fails after max attempts, show "Connection failed" with retry button

## Output

- Chat panel showing message history
- Real-time streaming of Claude responses
- Tool use indicators
- Status indicators (thinking, tool use, responding)
- Markdown rendering in messages
- Auto-scroll with scroll-to-bottom button
- Connection status handling
