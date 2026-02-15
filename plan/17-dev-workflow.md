# 17 - Dev Scripts, Environment Setup, and Running Locally

## Goal

Document how to set up the development environment, run all packages, and common development tasks.

## Steps

### 17.1 Prerequisites

- Node.js >= 20
- pnpm >= 9
- (Optional) Docker for PostgreSQL/MySQL/MongoDB

### 17.2 Initial setup

```bash
# Clone and install
git clone <repo-url>
cd claude-chat
pnpm install

# Copy environment
cp .env.example .env
# Edit .env with your values:
#   - ANTHROPIC_API_KEY (required)
#   - API_KEYS (set at least one key for auth)
#   - DB_DRIVER=sqlite (easiest to start)
```

### 17.3 Dev mode (all packages)

```bash
# Start everything in parallel
pnpm dev
```

This runs concurrently:
- `@claude-chat/shared` - TypeScript watch mode (rebuilds types)
- `@claude-chat/db` - TypeScript watch mode
- `@claude-chat/client` - TypeScript watch mode
- `@claude-chat/server` - tsx watch mode (auto-restart on changes), port 3000
- `@claude-chat/ui` - Vite dev server, port 5173 (proxies /api to :3000)

### 17.4 Individual package dev

```bash
# Run just the server
pnpm --filter @claude-chat/server dev

# Run just the UI
pnpm --filter @claude-chat/ui dev

# Build a specific package
pnpm --filter @claude-chat/shared build
```

### 17.5 Database setup by driver

#### SQLite (default)
No setup needed. The file is created automatically at `SQLITE_PATH`.

#### PostgreSQL
```bash
# Using Docker
docker run -d --name claude-chat-pg \
  -e POSTGRES_USER=claude \
  -e POSTGRES_PASSWORD=claude \
  -e POSTGRES_DB=claude_chat \
  -p 5432:5432 \
  postgres:16

# Set in .env
DB_DRIVER=postgres
POSTGRES_URL=postgresql://claude:claude@localhost:5432/claude_chat
```

#### MySQL
```bash
# Using Docker
docker run -d --name claude-chat-mysql \
  -e MYSQL_ROOT_PASSWORD=claude \
  -e MYSQL_DATABASE=claude_chat \
  -p 3306:3306 \
  mysql:8

# Set in .env
DB_DRIVER=mysql
MYSQL_URL=mysql://root:claude@localhost:3306/claude_chat
```

#### MongoDB
```bash
# Using Docker
docker run -d --name claude-chat-mongo \
  -p 27017:27017 \
  mongo:7

# Set in .env
DB_DRIVER=mongodb
MONGODB_URL=mongodb://localhost:27017/claude_chat
```

### 17.6 Run migrations

For SQL databases, run migrations before first start:

```bash
pnpm --filter @claude-chat/db migrate
```

This should be implemented as a script in the db package that:
1. Reads DB_DRIVER from env
2. Runs Drizzle migrations for the correct dialect
3. For MongoDB, creates indexes

### 17.7 Build for production

```bash
# Build all packages
pnpm build

# Start production server
cd packages/server && pnpm start
```

The production server serves:
- API routes at `/api/*`
- Static UI files from `packages/ui/dist/` (via Hono's static file middleware)

### 17.8 Add static file serving for production

In `packages/server/src/app.ts`, add for production:

```typescript
import { serveStatic } from "@hono/node-server/serve-static";

if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "../ui/dist" }));
  // SPA fallback
  app.get("*", serveStatic({ path: "../ui/dist/index.html" }));
}
```

### 17.9 Docker Compose (optional)

Create `docker-compose.yml` for running the full stack:

```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: claude_chat
      POSTGRES_USER: claude
      POSTGRES_PASSWORD: claude
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 17.10 TypeScript build order

Packages must build in dependency order:
1. `@claude-chat/shared` (no deps)
2. `@claude-chat/db` (depends on shared)
3. `@claude-chat/client` (depends on shared)
4. `@claude-chat/server` (depends on shared, db, client)
5. `@claude-chat/ui` (depends on shared)

In dev mode with watch, pnpm handles this via workspace protocol. For production builds, run in order or use a build orchestrator.

### 17.11 Useful commands reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in dev mode |
| `pnpm build` | Build all packages for production |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | Type-check all packages |
| `pnpm --filter <pkg> dev` | Dev mode for one package |
| `pnpm add <dep> --filter <pkg>` | Add dependency to a package |
| `pnpm add -Dw <dep>` | Add root dev dependency |

## Output

- Complete development setup instructions
- Per-database-driver setup guide
- Production build and deployment flow
- Docker Compose for full stack
- Build order documented
