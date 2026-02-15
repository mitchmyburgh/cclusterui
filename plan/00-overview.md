# 00 - Project Overview & Architecture

## Project Name

`claude-chat` (working name)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     UI (React + Vite PWA)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Chat 1   │  │  Chat 2   │  │  Chat 3   │  ...       │
│  │  Panel    │  │  Panel    │  │  Panel    │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│       └──────────────┴──────────────┘                    │
│                      │                                   │
│              API Key (localStorage)                      │
└──────────────────────┬───────────────────────────────────┘
                       │  REST + WebSocket
                       │
┌──────────────────────┴───────────────────────────────────┐
│                   Server (Hono)                           │
│                                                           │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Auth       │  │  Chat Routes  │  │  WebSocket Hub   │ │
│  │  Middleware  │  │  (REST)       │  │  (per-chat)      │ │
│  └────────────┘  └──────────────┘  └────────┬─────────┘ │
│                                              │           │
│  ┌──────────────────────────────────────┐    │           │
│  │  Database Abstraction Layer           │    │           │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐ │    │           │
│  │  │ SQLite  │ │Postgres│ │  MySQL   │ │    │           │
│  │  └────────┘ └────────┘ └──────────┘ │    │           │
│  │  ┌──────────┐                        │    │           │
│  │  │ MongoDB   │                        │    │           │
│  │  └──────────┘                        │    │           │
│  └──────────────────────────────────────┘    │           │
│                                              │           │
│  ┌───────────────────────────────────────────┴─────────┐ │
│  │              Client Manager                          │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐       │ │
│  │  │ Session 1  │  │ Session 2  │  │ Session 3  │  ... │ │
│  │  └───────────┘  └───────────┘  └───────────┘       │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                       │
                       │  Claude Agent SDK
                       │
┌──────────────────────┴───────────────────────────────────┐
│                Client (@anthropic-ai/claude-agent-sdk)    │
│                                                           │
│  - Uses .claude/ directory for settings/sessions          │
│  - Streams responses via async generators                 │
│  - Session management (create, resume, fork)              │
│  - Built-in tools: Read, Write, Edit, Bash, Glob, Grep   │
│  - Image support via multimodal messages                  │
└──────────────────────────────────────────────────────────┘
```

## Packages (pnpm workspace)

| Package | Path | Description |
|---------|------|-------------|
| `@claude-chat/ui` | `packages/ui` | React + Vite PWA frontend |
| `@claude-chat/server` | `packages/server` | Hono HTTP + WebSocket server |
| `@claude-chat/client` | `packages/client` | Claude Agent SDK wrapper |
| `@claude-chat/shared` | `packages/shared` | Shared TypeScript types & constants |
| `@claude-chat/db` | `packages/db` | Database abstraction layer |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, TailwindCSS v4 |
| PWA | vite-plugin-pwa (Workbox) |
| Server | Hono (Node.js adapter), hono/websocket |
| SQL ORM | Drizzle ORM (SQLite, PostgreSQL, MySQL) |
| MongoDB | mongodb native driver |
| AI Client | @anthropic-ai/claude-agent-sdk |
| Auth | API key (env on server, localStorage on client) |
| Monorepo | pnpm workspaces |

## Data Model (Simplified)

```
User (implicit via API key)
  └── Chat
       ├── id (uuid)
       ├── title
       ├── created_at
       ├── updated_at
       ├── session_id (Claude Agent SDK session)
       └── Messages[]
            ├── id (uuid)
            ├── chat_id (fk)
            ├── role (user | assistant)
            ├── content (text + optional images)
            ├── created_at
            └── metadata (token usage, cost, etc.)
```

## Authentication Flow

1. User enters API key in UI settings
2. UI stores key in localStorage
3. Every request includes `Authorization: Bearer <key>` header
4. Server middleware validates key against `API_KEYS` env var (comma-separated list)
5. Invalid key returns 401

## Chat Flow

1. User creates a new chat -> POST /api/chats -> returns chat object
2. UI opens WebSocket -> ws://server/api/chats/:id/ws?token=<key>
3. User sends message (text + optional images) -> WebSocket message
4. Server persists user message to DB
5. Server sends message to Claude Agent SDK client (streaming)
6. As Claude streams response, server forwards chunks via WebSocket
7. On completion, server persists assistant message to DB
8. UI renders streamed response in real-time

## Plan Files

| File | Topic |
|------|-------|
| [01-workspace-setup.md](./01-workspace-setup.md) | pnpm workspace + base config |
| [02-shared-types.md](./02-shared-types.md) | Shared TypeScript types package |
| [03-database-layer.md](./03-database-layer.md) | Database abstraction (SQL + MongoDB) |
| [04-server-scaffold.md](./04-server-scaffold.md) | Hono server scaffold |
| [05-auth.md](./05-auth.md) | API key authentication |
| [06-client-package.md](./06-client-package.md) | Claude Agent SDK client wrapper |
| [07-server-routes.md](./07-server-routes.md) | REST API + WebSocket routes |
| [08-server-integration.md](./08-server-integration.md) | Wire server, client, and DB together |
| [09-ui-scaffold.md](./09-ui-scaffold.md) | Vite + React + PWA scaffold |
| [10-ui-auth.md](./10-ui-auth.md) | Frontend auth (API key in localStorage) |
| [11-ui-chat-list.md](./11-ui-chat-list.md) | Chat list sidebar (WhatsApp-style) |
| [12-ui-chat-panel.md](./12-ui-chat-panel.md) | Chat panel with message rendering |
| [13-ui-multi-panel.md](./13-ui-multi-panel.md) | Multi-panel layout (multiple chats open) |
| [14-ui-image-paste.md](./14-ui-image-paste.md) | Image paste/upload in chat input |
| [15-pwa-config.md](./15-pwa-config.md) | PWA manifest, service worker, offline |
| [16-testing.md](./16-testing.md) | Testing strategy |
| [17-dev-workflow.md](./17-dev-workflow.md) | Dev scripts, env setup, running locally |
