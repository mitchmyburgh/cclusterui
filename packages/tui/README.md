# @ccluster/tui

Terminal UI for Claude Chat -- a full-featured, keyboard-driven chat client rendered directly in your terminal. Built with [Ink 5](https://github.com/vadimdemedes/ink) (React for CLIs) and connected to a `ccluster` server over REST + WebSocket.

## Overview

`@ccluster/tui` provides the `claude-chat` CLI binary. It lets you browse, select, and interact with chat sessions hosted on a ccluster relay server. Messages from the assistant are streamed in real time via WebSocket and rendered as formatted Markdown with syntax highlighting, all without leaving the terminal.

The TUI operates as a **viewer** client. It connects to a chat's WebSocket channel with the `viewer` role, receives streamed assistant responses, and sends user messages. The actual LLM inference is handled by a **producer** (local client) that must also be connected to the same chat session.

## Installation

```bash
# From the monorepo root
pnpm install
pnpm -r run build

# Or link the binary globally
cd packages/tui
pnpm link --global
```

Once linked, the `claude-chat` command is available system-wide.

## CLI Usage

```
claude-chat [options]
```

### Options

| Flag | Description | Default |
|---|---|---|
| `-s, --server <url>` | Server URL | `CLAUDE_CHAT_SERVER` env var, or `http://localhost:3000` |
| `-k, --api-key <key>` | API key (JWT) for authentication | `CLAUDE_CHAT_API_KEY` env var |
| `-u, --username <name>` | Username for login (instead of API key) | -- |
| `-p, --password <pass>` | Password for login (instead of API key) | -- |

### Authentication

You must provide credentials via one of two methods:

1. **API key** -- Pass a pre-existing JWT with `--api-key` or set the `CLAUDE_CHAT_API_KEY` environment variable.
2. **Username/password** -- Pass `--username` and `--password`. The CLI will call `POST /api/auth/login` on the server, obtain a JWT, and use it for the session.

### Examples

```bash
# Connect with an API key
claude-chat --server https://my-server.example.com --api-key eyJhbG...

# Connect with username/password
claude-chat -s http://localhost:3000 -u alice -p secret

# Use environment variables
export CLAUDE_CHAT_SERVER=http://localhost:3000
export CLAUDE_CHAT_API_KEY=eyJhbG...
claude-chat
```

## Features

### Chat List View

The landing screen fetches all chats from the server and displays them in a navigable list.

**Keyboard shortcuts:**

| Key | Action |
|---|---|
| Up / Down arrows | Navigate the chat list |
| Enter | Open the selected chat |
| `d` | Delete the selected chat |
| `r` | Refresh the chat list |
| `q` | Quit the application |

### Chat View

Once a chat is selected, the Chat View opens a full conversation interface with real-time streaming.

**Header bar** -- Shows the chat title, producer (local client) connection status, and WebSocket connection status.

**Message list** -- Displays the full conversation history. User messages appear in blue; assistant messages appear in green and are rendered as terminal-formatted Markdown. Each assistant message can show metadata (model name, response duration, cost).

**Input prompt** -- A bordered text input at the bottom of the screen. Automatically disables while the assistant is streaming, when WebSocket is disconnected, or when no producer client is connected.

**Keyboard shortcuts:**

| Key | Action |
|---|---|
| Enter | Send the current message |
| Escape | Cancel a streaming response, or go back to the chat list |

### Real-time Streaming

The TUI subscribes to a chat's WebSocket channel and processes the following server events:

- **message_start / message_delta / message_complete** -- Progressive streaming of assistant responses with live Markdown rendering.
- **user_message_stored** -- Replaces optimistic (temp) user messages with the server-persisted version, and appends messages sent by other viewers.
- **tool_use** -- Displays the name of the tool currently being invoked by the assistant.
- **status** -- Shows the assistant's current state (thinking, tool_use, responding, idle).
- **producer_status** -- Indicates whether a local producer client is connected.
- **error** -- Displays server-side errors inline.

### Markdown Rendering

Assistant messages are rendered through [marked](https://github.com/markedjs/marked) with the [marked-terminal](https://github.com/mikaelkael/marked-terminal) renderer. This provides formatted output for headings, bold/italic text, code blocks with syntax highlighting, lists, links, and other Markdown constructs -- all directly in the terminal.

### Optimistic Message Sending

When you send a message, the TUI immediately appends it to the conversation with a temporary ID (`temp-<timestamp>`) so the UI feels instant. Once the server confirms storage via the `user_message_stored` event, the temporary message is replaced with the canonical server version.

## Architecture

```
packages/tui/
  src/
    index.tsx              CLI entrypoint (Commander + Ink render)
    App.tsx                Root component, view router (list vs. chat)
    api.ts                 REST API client (fetch-based)
    ws.ts                  WebSocket client (Node ws library)
    components/
      Input.tsx            Text input with submit handling
      MessageList.tsx      Message display with Markdown rendering
    views/
      ChatListView.tsx     Chat list with keyboard navigation
      ChatView.tsx         Chat conversation with streaming
```

### Module Breakdown

**`index.tsx`** -- The CLI entrypoint. Uses Commander to parse arguments, handles authentication (API key or username/password login), and renders the root `<App />` component with Ink.

**`App.tsx`** -- A minimal view router. Maintains a `view` state that is either `{ type: "list" }` or `{ type: "chat", chat }`, and renders the corresponding view component. Creates the API client and passes it down.

**`api.ts`** -- A lightweight REST client factory. `createApiClient(serverUrl, apiKey)` returns an object with methods for `listChats`, `createChat`, `deleteChat`, `getChat`, and `getMessages`. All requests attach a Bearer token and handle HTTP errors uniformly.

**`ws.ts`** -- WebSocket client factory. `connectWs(serverUrl, apiKey, chatId, role)` opens a WebSocket connection to `/api/chats/:chatId/ws` with token-based authentication. Returns an object with `send`, `close`, `onEvent`, `onClose`, and `onOpen` methods. Uses the typed `WSViewerEvent` and `WSServerToViewerEvent` from `@ccluster/shared`.

**`components/Input.tsx`** -- A controlled text input component. Shows a blue `>` prompt when active, or a "Waiting for response..." message when disabled. Submits on Enter and clears the input.

**`components/MessageList.tsx`** -- Renders the conversation. User messages are shown as plain text; assistant messages are piped through `marked` with `marked-terminal` for rich Markdown output. Displays a live-updating streaming block when the assistant is responding. Shows message metadata (model, duration, cost) in dimmed text.

**`views/ChatListView.tsx`** -- Fetches chats via the REST API on mount and renders a navigable list. Uses Ink's `useInput` hook for keyboard navigation. Supports inline delete and refresh.

**`views/ChatView.tsx`** -- The main chat interface. On mount it loads message history via REST, then opens a WebSocket connection as a `viewer`. Processes all `WSServerToViewerEvent` types to update messages, streaming state, status indicators, and connection health. Sends `send_message` and `cancel` events via WebSocket.

## Dependencies

| Package | Purpose |
|---|---|
| `ink` (v5) | React renderer for terminal UIs |
| `ink-spinner` | Animated loading spinners |
| `ink-text-input` | Terminal text input component |
| `commander` | CLI argument parsing |
| `marked` | Markdown parser |
| `marked-terminal` | Terminal renderer for marked |
| `ws` | WebSocket client for Node.js |
| `react` | Component model and hooks |
| `@ccluster/shared` | Shared types (Chat, Message, WS events, API response shapes) |

## Development

```bash
# Run in development mode (tsx, no build step)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Type-check without emitting
pnpm typecheck

# Run tests
pnpm test
```

The development entry point uses `tsx` to run `src/index.tsx` directly, so you can iterate without rebuilding. The production binary at `dist/index.js` includes the `#!/usr/bin/env node` shebang and is the target of the `bin.claude-chat` field in `package.json`.
