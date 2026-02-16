# @claude-chat/client

Local client that runs the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) against your codebase and streams results to a ccluster server over WebSocket.

## Overview

`@claude-chat/client` is the **producer** half of the ccluster architecture. It connects to a ccluster server instance, receives user prompts relayed from the web UI (the "viewer"), executes Claude locally with full tool access (file read/write, shell, search, web), and streams every event -- thinking status, text deltas, tool invocations, and final results -- back through the server to the viewer.

Because the Agent SDK runs on your machine, Claude operates directly on your local filesystem with your credentials. The server never sees your code or your Anthropic API key; it only relays the WebSocket event stream between viewer and producer.

### Key capabilities

- **Local execution** -- Claude reads, writes, and runs commands on your machine, not the server.
- **Session resume** -- the server tracks a session ID so conversations survive reconnects.
- **Auto-reconnect** -- if the WebSocket drops, the client reconnects automatically after 3 seconds.
- **Heartbeat** -- a `heartbeat` event is sent every 15 seconds (`WS_HEARTBEAT_INTERVAL`) to keep the connection alive.
- **Human-in-the-loop (HITL)** -- optionally require approval for write/exec tools before Claude can use them.
- **Abort / cancel** -- the server can send a `cancel` event to abort the running agent turn mid-flight.

## Installation

Within the ccluster monorepo:

```bash
pnpm install          # from the repo root
pnpm -r run build     # build all packages including this one
```

The package exposes a CLI binary called `claude-chat-client`, available after build at `dist/cli.js`.

## CLI Usage

```
claude-chat-client --server <url> [options]
```

### Required flags

| Flag | Description |
|---|---|
| `--server <url>` | ccluster server URL (e.g. `http://localhost:3000`). |

### Authentication (one of the following is required)

| Flag | Description |
|---|---|
| `--api-key <key>` | A pre-existing API key or JWT token for the server. |
| `--username <user> --password <pass>` | Log in with credentials. The client POSTs to `/api/auth/login` and uses the returned JWT for the session. |

### Optional flags

| Flag | Default | Description |
|---|---|---|
| `--chat <id>` | *(create new)* | Chat ID to attach to. If omitted the client creates a new chat via `POST /api/chats`. |
| `--anthropic-key <key>` | `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` from env | Anthropic API key passed to the Agent SDK. |
| `--cwd <path>` | `.` (current directory) | Working directory for all Claude file and shell operations. |
| `--hitl` | disabled | Enable human-in-the-loop approval mode (see below). |

### Examples

Connect to a server with an API key and let the client create a new chat:

```bash
claude-chat-client \
  --server http://localhost:3000 \
  --api-key my-jwt-token \
  --cwd /home/user/project
```

Attach to an existing chat with username/password auth and HITL enabled:

```bash
claude-chat-client \
  --server https://ccluster.example.com \
  --username alice --password s3cret \
  --chat abc-123 \
  --anthropic-key sk-ant-... \
  --hitl
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Default Anthropic key when `--anthropic-key` is not provided. |
| `CLAUDE_CODE_OAUTH_TOKEN` | Alternative Anthropic auth token (used if `ANTHROPIC_API_KEY` is unset). |
| `CLAUDE_MODEL` | Override the model used by the Agent SDK. Defaults to `claude-opus-4-6`. |

All current environment variables are forwarded to the Agent SDK process, so any tool that shells out (e.g. `Bash`) inherits your full environment.

## Human-in-the-Loop (HITL)

When the `--hitl` flag is passed, the client enters **approval mode**. In this mode every tool invocation is evaluated before execution:

1. **Auto-allowed (read-only) tools** -- `Read`, `Glob`, and `Grep` are always permitted without prompting. These tools cannot modify the filesystem.
2. **All other tools** -- `Write`, `Edit`, `Bash`, `WebSearch`, and `WebFetch` trigger an approval request. The client sends a `tool_approval_request` event to the server, which forwards it to the viewer (web UI). The viewer displays the tool name and input, and the user can:
   - **Approve** -- the tool runs.
   - **Approve + Always Allow** -- the tool runs, and that tool name is auto-approved for the rest of the session.
   - **Deny** -- Claude is told the user denied permission and must find another approach.

If the WebSocket disconnects or the operation is cancelled while an approval is pending, all outstanding approval promises are automatically resolved as denied.

Without `--hitl`, the client runs in **bypass-permissions** mode: every tool is executed immediately without any approval prompt.

## Architecture

```
Viewer (Web UI / TUI)
        |
        | WSViewerEvent
        v
  +-----------+
  |  Server   |  (relay + persistence)
  +-----------+
        |
        | WSServerToProducerEvent
        v
  +-----------+          +------------------------------+
  |  Client   |  ------> | @anthropic-ai/claude-agent-sdk |
  | (this pkg)|  <------ |  query() async generator       |
  +-----------+          +------------------------------+
        |
        | WSProducerEvent
        v
      Server --> Viewer
```

### Source files

| File | Role |
|---|---|
| `src/cli.ts` | CLI entry point. Parses flags with `commander`, handles login, creates `LocalClient`, wires up graceful shutdown on `SIGTERM`/`SIGINT`. |
| `src/local-client.ts` | `LocalClient` class. Manages the WebSocket lifecycle (connect, heartbeat, reconnect, disconnect), dispatches incoming server events, and sends producer events. |
| `src/claude-runner.ts` | `runClaude()` async generator. Wraps `@anthropic-ai/claude-agent-sdk`'s `query()` call, translates SDK events into `WSProducerEvent` values, and implements the HITL `canUseTool` callback. |
| `src/index.ts` | Public API barrel file. Re-exports `LocalClient`, `LocalClientOptions`, `runClaude`, and `RunClaudeOptions`. |

### WebSocket protocol

The client connects as a **producer** at:

```
ws(s)://<server>/api/chats/<chatId>/ws?token=<jwt>&role=producer&hostname=<host>&cwd=<path>[&hitl=true]
```

**Incoming events** (`WSServerToProducerEvent`):

| Event | Description |
|---|---|
| `process_message` | A user sent a message. Contains `content`, `sessionId`, and `messageHistory`. Triggers a `runClaude()` invocation. |
| `cancel` | Abort the running agent turn. |
| `tool_approval_response` | The viewer approved or denied a pending tool (HITL mode only). |

**Outgoing events** (`WSProducerEvent`):

| Event | Description |
|---|---|
| `status` | Status transitions: `thinking`, `tool_use`, `responding`, `idle`. |
| `message_start` | Signals that a new assistant message is being generated. |
| `message_delta` | Incremental text chunk from the model. |
| `message_complete` | Final assembled message with metadata (cost, tokens, duration, model). Includes the `sessionId` for resume. |
| `tool_use` | Claude is invoking a tool (name + input). |
| `error` | Something went wrong during execution. |
| `heartbeat` | Periodic keep-alive signal (every 15 s). |
| `tool_approval_request` | Asks the viewer to approve a tool invocation (HITL mode only). |

### Session resume

When the server sends a `process_message` with a non-null `sessionId`, the client passes it as the `resume` option to the Agent SDK's `query()` call. This lets Claude continue from exactly where the previous turn left off, preserving full conversation context across reconnects and multiple user messages.

### Allowed tools

The Agent SDK is configured with the following tool set:

- `Read` -- read files
- `Write` -- write files
- `Edit` -- edit files (string replacement)
- `Bash` -- run shell commands
- `Glob` -- file pattern matching
- `Grep` -- content search
- `WebSearch` -- web search
- `WebFetch` -- fetch and process URLs

The maximum number of agent turns per invocation is capped at **50** (`maxTurns`).

## Programmatic API

The package also exports its core classes for use from other Node.js code:

```ts
import { LocalClient, runClaude } from "@claude-chat/client";
import type { LocalClientOptions, RunClaudeOptions } from "@claude-chat/client";
```

- **`LocalClient`** -- instantiate with `LocalClientOptions`, call `.connect()` to start, `.disconnect()` to stop.
- **`runClaude()`** -- standalone async generator that runs a single agent turn and yields `WSProducerEvent` objects. Useful if you want to integrate Claude execution without the WebSocket layer.

## Development

```bash
# Type-check
pnpm --filter @claude-chat/client run typecheck

# Build
pnpm --filter @claude-chat/client run build

# Watch mode (rebuilds on save)
pnpm --filter @claude-chat/client run dev

# Run tests
pnpm --filter @claude-chat/client run test
```

## License

See the repository root for license information.
