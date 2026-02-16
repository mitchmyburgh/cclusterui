# CCluster

A full-stack, multi-interface AI assistant platform powered by Claude. Run Claude Agent SDK locally on your machine while managing conversations through a web UI, terminal UI, or API -- all connected in real time via WebSocket.

## Architecture

```
                     +------------------+
                     |   Web UI (React) |  :5173
                     +--------+---------+
                              |
                              | HTTP / WS
                              v
+-------------+      +-------+--------+      +----------------+
| Terminal UI | ---> |  Server (Hono) | <--> |   Database     |
|   (Ink)     |  WS  |   :3000        |      | SQLite / PG /  |
+-------------+      +-------+--------+      | MySQL / Mongo  |
                              |               +----------------+
                              | WS
                              v
                     +--------+---------+
                     | Local Client     |
                     | (Claude Agent    |
                     |  SDK)            |
                     +------------------+
                              |
                     Tool execution on
                     your local machine
```

**Key idea:** The server never talks to Anthropic directly. The local client runs on your machine, holds your Anthropic API key, and executes tool calls (file edits, shell commands, etc.) against your local filesystem. The server relays messages and persists chat history.

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- An **Anthropic API key** (set `ANTHROPIC_API_KEY` in your environment)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start all packages in dev mode (watch + hot reload)
pnpm dev

# Type-check the entire monorepo
pnpm typecheck

# Run all tests
pnpm test

# Build everything for production
pnpm build
```

### Running the client

The local client connects to the server and runs Claude Agent SDK on your machine:

```bash
# With API key auth
node packages/client/dist/cli.js \
  --server http://localhost:3000 \
  --api-key <your-api-key-or-jwt>

# With username/password auth
node packages/client/dist/cli.js \
  --server http://localhost:3000 \
  --username alice --password secret

# Resume an existing chat
node packages/client/dist/cli.js \
  --server http://localhost:3000 \
  --api-key <key> \
  --chat <chat-id>

# Create a named chat
node packages/client/dist/cli.js \
  --server http://localhost:3000 \
  --api-key <key> \
  --name "Refactor auth module"

# Enable human-in-the-loop tool approval
node packages/client/dist/cli.js \
  --server http://localhost:3000 \
  --api-key <key> \
  --hitl
```

## Packages

| Package | Path | Description |
|---------|------|-------------|
| [`@ccluster/shared`](packages/shared) | `packages/shared` | Shared TypeScript types, constants, WebSocket event definitions |
| [`@ccluster/db`](packages/db) | `packages/db` | Multi-database abstraction layer with Drizzle ORM (SQLite, PostgreSQL, MySQL, MongoDB) |
| [`@ccluster/client`](packages/client) | `packages/client` | Local client -- runs Claude Agent SDK on your machine, connects to server via WebSocket |
| [`@ccluster/server`](packages/server) | `packages/server` | Hono-based REST + WebSocket server -- auth, chat CRUD, message relay |
| [`@ccluster/ui`](packages/ui) | `packages/ui` | React 19 web UI with Vite, Tailwind CSS v4, PWA support |
| [`@ccluster/tui`](packages/tui) | `packages/tui` | Terminal UI built with Ink (React for CLI) |

## Environment Variables

Configure the server via environment variables or a `.env` file in `packages/server`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server listen port |
| `HOST` | `0.0.0.0` | Server bind address |
| `JWT_SECRET` | *(none)* | Secret for signing JWTs. If unset, JWT auth is disabled |
| `API_KEYS` | *(none)* | Comma-separated list of valid static API keys |
| `ALLOWED_USERNAMES` | *(none)* | Comma-separated list of usernames allowed to register/login |
| `DB_DRIVER` | `sqlite` | Database backend: `sqlite`, `postgres`, `mysql`, or `mongodb` |
| `SQLITE_PATH` | `./data/claude-chat.db` | Path to SQLite database file |
| `POSTGRES_URL` | *(none)* | PostgreSQL connection string |
| `MYSQL_URL` | *(none)* | MySQL connection string |
| `MONGODB_URL` | *(none)* | MongoDB connection string |
| `MONGODB_NAME` | *(none)* | MongoDB database name |

The client reads `ANTHROPIC_API_KEY` (or `CLAUDE_CODE_OAUTH_TOKEN`) from the environment, or accepts it via `--anthropic-key`.

## Docker

The included multi-stage Dockerfile builds the server + web UI into a single production image (~200 MB). Only the `shared`, `db`, `server`, and `ui` packages are included; the `client` and `tui` run on your local machine.

### Build & run locally

```bash
# Build
docker build -t ccluster .

# Run with SQLite (default)
docker run -p 3000:3000 \
  -e JWT_SECRET=changeme \
  -e API_KEYS=my-secret-key \
  -v ccluster-data:/app/data \
  ccluster

# Run with PostgreSQL
docker run -p 3000:3000 \
  -e JWT_SECRET=changeme \
  -e DB_DRIVER=postgres \
  -e POSTGRES_URL=postgresql://user:pass@host:5432/ccluster \
  ccluster
```

The image exposes port **3000** and serves both the API and the built web UI static files.

### Dockerfile stages

| Stage | Purpose |
|-------|---------|
| `base` | `node:20-slim` with pnpm 9 enabled via corepack |
| `deps` | Copies all `package.json` files and runs `pnpm install --frozen-lockfile` |
| `build` | Copies source for shared, db, server, and ui; builds each in dependency order |
| `runtime` | Copies only built `dist/` directories and `node_modules` — no source code |

### Deploy on Railway

Railway auto-detects the Dockerfile. Create a new project and set these environment variables:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | A random secret string |
| `API_KEYS` | Comma-separated API keys for authentication |
| `PORT` | `3000` (Railway sets this automatically via `$PORT`) |
| `DB_DRIVER` | `postgres` (recommended for Railway) |
| `POSTGRES_URL` | `${{Postgres.DATABASE_URL}}` (add a Postgres plugin first) |

Steps:

1. Create a new project on [Railway](https://railway.app) and connect your GitHub repo.
2. Add a **PostgreSQL** plugin to the project.
3. Set the environment variables above in the service settings. Reference the Postgres plugin's `DATABASE_URL` for `POSTGRES_URL`.
4. Railway will build from the Dockerfile and deploy automatically on push to `main`.
5. Once deployed, point your local client at the Railway URL:
   ```bash
   node packages/client/dist/cli.js \
     --server https://your-app.up.railway.app \
     --api-key <your-api-key> \
     --cwd /path/to/your/project
   ```

> **Note:** The Docker image contains only the server and web UI. The local client must run on your machine (outside Docker) so it has access to your filesystem for tool execution.

## Human-in-the-Loop (HITL)

When the client is started with `--hitl`, every write or exec tool call from Claude requires your manual approval before it runs. This gives you a chance to review file edits, shell commands, and other side effects before they happen.

Without the flag, all tool calls are auto-approved.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

1. **CI** -- `pnpm typecheck` / `pnpm test` / `pnpm build`
2. **Docker** -- Builds the image; pushes to `ghcr.io` on `main`
3. **Publish** -- Publishes all packages to GitHub Packages on `main`

## License

[MIT](LICENSE)
