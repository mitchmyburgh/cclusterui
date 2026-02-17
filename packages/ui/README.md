# @mitchmyburgh/ui

The web-based frontend for Claude Chat -- a multi-panel, real-time chat interface for interacting with Claude through a relay server. Built with React 19, Vite 7, and Tailwind CSS 4, it supports Progressive Web App (PWA) installation, live-streaming responses, image uploads, and human-in-the-loop (HITL) tool approval.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Component Architecture](#component-architecture)
  - [Entry Point](#entry-point)
  - [Layout](#layout)
  - [Chat Components](#chat-components)
  - [Auth Components](#auth-components)
  - [Settings Components](#settings-components)
  - [Hooks](#hooks)
  - [Libraries](#libraries)
  - [Context](#context)
- [Human-in-the-Loop (HITL) UI](#human-in-the-loop-hitl-ui)
- [Development](#development)
- [Build](#build)
- [Project Structure](#project-structure)

## Overview

`@mitchmyburgh/ui` is one package in the `cclusterui` monorepo. It serves as the viewer layer in a three-tier architecture:

```
Producer (local client) <--ws--> Server (relay) <--ws--> Viewer (this package)
```

The UI connects to the server over WebSockets as a **viewer**. A separate **producer** (the local CLI client) connects to the same server and runs Claude. Messages flow through the server in real time: user input is sent from the viewer to the server, relayed to the producer, and Claude's streamed response is relayed back to the viewer token-by-token.

Shared types and constants are imported from the `@mitchmyburgh/shared` workspace package, ensuring type-safe communication across the stack.

## Features

- **Multi-panel chat** -- Open up to three chat conversations side-by-side in a split-pane layout.
- **Real-time streaming** -- Token-by-token response rendering over WebSocket with a blinking cursor indicator.
- **Markdown rendering** -- Assistant responses are rendered as rich Markdown using `react-markdown` with Tailwind Typography (`prose-invert`).
- **Image upload** -- Attach images via file picker, drag-and-drop, or clipboard paste. Supports PNG, JPEG, GIF, and WebP up to 10 MB.
- **Human-in-the-loop (HITL) tool approval** -- When the producer requests permission for a tool call (e.g., `Bash`, `Write`, `Edit`), a review dialog appears in the chat panel, letting the user Allow, Always Allow, or Deny the action.
- **PWA support** -- Installable as a standalone app with offline asset caching (Workbox) and a `NetworkFirst` strategy for API requests.
- **Authentication** -- Supports both JWT-based login/register and raw API key authentication, with localStorage persistence and automatic 401 handling.
- **API key management** -- Authenticated users can create, view, and revoke API keys from the Settings panel.
- **Producer connection status** -- Each chat panel shows a green/red dot indicating whether a local client is connected to that chat.
- **Auto-reconnect** -- WebSocket connections automatically reconnect with exponential backoff (up to 5 attempts, max 30-second delay).
- **Dark theme** -- Full dark-mode UI with custom scrollbar styling.
- **Chat search** -- Filter the sidebar chat list by title.

## Component Architecture

### Entry Point

**`main.tsx`** -- Mounts the React 19 app into the DOM inside `<StrictMode>`.

**`App.tsx`** -- Wraps the application in `<AuthProvider>`. If the user is not authenticated, the `<LoginForm>` is shown; otherwise the `<AppLayout>` is rendered.

### Layout

**`components/layout/AppLayout.tsx`** -- The top-level authenticated layout. Renders a sidebar (chat list, user info, settings/logout buttons) and a main content area. The main area displays either the `<SettingsPanel>`, an empty-state prompt, or one to three `<ChatPanel>` components side-by-side. Manages the list of open panel IDs and enforces a maximum of three concurrent panels.

### Chat Components

**`components/chat/ChatPanel.tsx`** -- The core chat component. For a given `chatId`, it:

- Fetches message history from the REST API on mount.
- Opens a WebSocket connection (via `useWebSocket`) to receive real-time events.
- Handles the full event lifecycle: `message_start`, `message_delta`, `message_complete`, `user_message_stored`, `tool_use`, `status`, `producer_status`, `tool_approval_request`, and `error`.
- Renders message history with `<MessageBubble>`, a live streaming bubble with a pulsing cursor, the `<ToolApprovalDialog>` when a tool approval is pending, and the `<ChatInput>` for composing messages.
- Adds user messages optimistically (prefixed with `temp-`) and reconciles them when the server confirms storage.

**`components/chat/ChatInput.tsx`** -- A composable text input with:

- Auto-resizing `<textarea>` (up to 150px).
- Image attachment via file picker button, clipboard paste (`onPaste`), or the file input's `onChange`.
- Image preview thumbnails with individual remove buttons.
- Send on `Enter` (Shift+Enter for newline), cancel on `Escape`.
- Disabled state when streaming or when no producer is connected, with an inline instruction banner.

**`components/chat/MessageBubble.tsx`** -- Renders a single message. User messages appear right-aligned in blue; assistant messages appear left-aligned in gray with Markdown formatting. Image content blocks are rendered inline. Metadata (model name, duration, cost) is shown beneath assistant messages when available.

**`components/chat/ChatList.tsx`** -- The sidebar chat list. Displays all chats with title, date, active highlight (blue left border), and a hover-reveal delete button. Includes a search input for filtering by title.

**`components/chat/ToolApprovalDialog.tsx`** -- Displays pending tool approval requests inline within the chat panel. See the [HITL UI](#human-in-the-loop-hitl-ui) section below.

### Auth Components

**`components/auth/LoginForm.tsx`** -- A tabbed form with three modes:

- **Login** -- Username/password authentication against `POST /api/auth/login`.
- **Register** -- New account creation against `POST /api/auth/register`.
- **API Key** -- Direct API key entry for simplified access.

**`components/auth/ApiKeyModal.tsx`** -- A simpler standalone API key entry modal (legacy).

### Settings Components

**`components/settings/SettingsPanel.tsx`** -- Displays the current user's profile and, for JWT-authenticated users, the `<ApiKeyManager>`.

**`components/settings/ApiKeyManager.tsx`** -- Full CRUD for API keys:

- Lists existing keys with name, prefix, and revocation status.
- Supports creating new keys (the raw key is shown once for copying).
- Supports revoking active keys.

### Hooks

**`hooks/useWebSocket.ts`** -- Custom hook encapsulating the WebSocket lifecycle:

- Constructs the URL from the current page origin (`ws:` or `wss:`), chat ID, API key, and `role=viewer` query parameter.
- Manages connection, auto-reconnect with exponential backoff, and cleanup on unmount.
- Parses incoming JSON events and dispatches them via a stable callback ref.
- Exposes `{ connected: boolean, send: (event: WSViewerEvent) => void }`.

The viewer can send three event types over the WebSocket:
| Event Type | Purpose |
|---|---|
| `send_message` | Sends user message content (text and/or images) |
| `cancel` | Cancels the current in-progress response |
| `tool_approval_response` | Responds to a HITL tool approval request |

### Libraries

**`lib/api.ts`** -- Factory function `createApiClient(apiKey)` that returns a typed HTTP client (`get`, `post`, `patch`, `delete`) with automatic Bearer token injection and 401-to-logout handling.

**`lib/storage.ts`** -- localStorage helpers for persisting the auth token and user profile. Supports both JWT tokens and legacy API keys with backward compatibility.

### Context

**`context/AuthContext.tsx`** -- React context providing authentication state to the entire app. Exposes:

- `token` / `apiKey` -- The current auth token (JWT or API key).
- `user` -- The authenticated user object (`{ id, username }`).
- `isAuthenticated` -- Boolean derived from token presence.
- `login(token, user)` -- Stores credentials and updates state.
- `setApiKey(key)` -- Legacy API-key-only authentication path.
- `logout()` -- Clears all stored credentials and resets state.

## Human-in-the-Loop (HITL) UI

When a producer (local client) is running with HITL mode enabled, tool calls are not automatically executed. Instead, they are forwarded to the viewer for explicit user approval.

### How It Works

1. The producer sends a `tool_approval_request` event through the server to the viewer.
2. `ChatPanel` stores the request in `pendingApproval` state and renders the `<ToolApprovalDialog>`.
3. The dialog displays:
   - A pulsing yellow indicator with "Approval Required" label.
   - The **tool name** as a badge (e.g., `Bash`, `Write`, `Edit`).
   - A **summary** of the tool input: for `Bash` tools the command string is shown directly, for `Write`/`Edit` tools the file path is shown, and for all other tools the full JSON input is displayed.
   - An expandable **full input** view for inputs longer than 200 characters.
4. The user chooses one of three actions:
   - **Allow** -- Approves this single tool call.
   - **Always Allow [ToolName]** -- Approves and tells the producer to auto-allow future calls to this tool.
   - **Deny** -- Rejects the tool call with a "User denied permission" message.
5. The response is sent back as a `tool_approval_response` WebSocket event.

### HITL Indicator

When a producer connects with HITL enabled, the `producer_status` event includes `hitl: true`. The chat panel header displays a yellow **HITL** badge to indicate the mode is active.

## Development

### Prerequisites

- Node.js 18+
- The monorepo dependencies installed at the root (`npm install` or equivalent)
- The `@mitchmyburgh/shared` package built (`tsc -b` in the shared package)

### Dev Server

```bash
npm run dev
```

Starts the Vite dev server on `http://localhost:5173` with hot module replacement. API and WebSocket requests to `/api` are proxied to `http://localhost:3000` (the server package).

### Type Checking

```bash
npm run typecheck
# or equivalently
npm run lint
```

Runs `tsc --noEmit` to check for type errors without emitting output.

### Testing

```bash
npm run test          # single run
npm run test:watch    # watch mode
```

Uses Vitest with global test APIs. Test files live in `src/__tests__/`.

## Build

```bash
npm run build
```

Runs `tsc -b` for type checking followed by `vite build`. The production output is written to `dist/`, which is the only directory included in the published package (see `files` in `package.json`).

### Preview

```bash
npm run preview
```

Serves the production build locally for verification.

### PWA Configuration

The Vite config (`vite.config.ts`) uses `vite-plugin-pwa` with:

- **`registerType: "autoUpdate"`** -- The service worker updates automatically in the background.
- **Manifest** -- App name "Claude Chat", standalone display mode, dark theme color (`#1a1a2e`), with 192px and 512px icons.
- **Workbox** -- Pre-caches all static assets (`js`, `css`, `html`, `ico`, `png`, `svg`, `woff2`). API requests use a `NetworkFirst` caching strategy with a 1-hour TTL and 100-entry limit. Navigation requests fall back to `/index.html` (SPA routing), except for `/api` paths.

## Project Structure

```
packages/ui/
  index.html                    HTML shell
  package.json                  Package manifest
  tsconfig.json                 TypeScript config (ES2022, bundler resolution)
  vite.config.ts                Vite + React + Tailwind + PWA plugins
  vitest.config.ts              Vitest test runner config
  public/
    icon-192.png                PWA icon (192x192)
    icon-192.svg                PWA icon SVG source
    icon-512.png                PWA icon (512x512)
    icon-512.svg                PWA icon SVG source
  src/
    main.tsx                    React DOM entry point
    App.tsx                     Root component with auth gating
    index.css                   Tailwind imports and scrollbar styles
    context/
      AuthContext.tsx            Auth state provider
    hooks/
      useWebSocket.ts           WebSocket connection hook
    lib/
      api.ts                    HTTP client factory
      storage.ts                localStorage persistence helpers
    components/
      layout/
        AppLayout.tsx           Sidebar + multi-panel layout
      chat/
        ChatPanel.tsx           Single chat panel with streaming
        ChatInput.tsx           Message composer with image support
        ChatList.tsx            Sidebar chat list with search
        MessageBubble.tsx       Message renderer with Markdown
        ToolApprovalDialog.tsx  HITL tool approval UI
      auth/
        LoginForm.tsx           Login / Register / API Key form
        ApiKeyModal.tsx         Standalone API key entry modal
      settings/
        SettingsPanel.tsx       User profile and settings
        ApiKeyManager.tsx       API key CRUD management
    __tests__/
      placeholder.test.ts      Placeholder test
  dist/                         Production build output
```
