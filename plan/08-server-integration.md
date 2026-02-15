# 08 - Wire Server, Client, and Database Together

## Goal

Connect the server entry point so that database, client manager, and routes all work together as a cohesive unit.

## Steps

### 8.1 Create application context / dependency injection

Create `packages/server/src/context.ts`:

```typescript
import { createRepository, type ChatRepository } from "@claude-chat/db";
import { ClientManager } from "@claude-chat/client";
import type { ServerConfig } from "./config.js";

export interface AppContext {
  repo: ChatRepository;
  clientManager: ClientManager;
  config: ServerConfig;
}

export async function createAppContext(config: ServerConfig): Promise<AppContext> {
  // 1. Create database repository from config
  const repo = await createRepository({
    driver: config.db.driver,
    sqlitePath: config.db.sqlitePath,
    postgresUrl: config.db.postgresUrl,
    mysqlUrl: config.db.mysqlUrl,
    mongodbUrl: config.db.mongodbUrl,
    mongodbName: config.db.mongodbName,
  });

  // 2. Create client manager
  const clientManager = new ClientManager({
    anthropicApiKey: config.anthropicApiKey,
    cwd: process.cwd(),  // or path to client package
  });

  return { repo, clientManager, config };
}
```

### 8.2 Make context available to routes

Approach: Use Hono's `c.set()` / `c.get()` to pass context, or use a module-level singleton.

Preferred: Initialize context at startup, then use a middleware to inject it:

```typescript
// In app.ts
app.use("*", async (c, next) => {
  c.set("repo", appContext.repo);
  c.set("clientManager", appContext.clientManager);
  c.set("config", appContext.config);
  await next();
});
```

Update `AppEnv` type:
```typescript
export type AppEnv = {
  Variables: {
    apiKey: string;
    repo: ChatRepository;
    clientManager: ClientManager;
    config: ServerConfig;
  };
};
```

### 8.3 Update server entry point

In `packages/server/src/index.ts`:

```typescript
import { createAppContext } from "./context.js";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const context = await createAppContext(config);
  const { app, upgradeWebSocket } = createApp(context);

  // Start server...
}

main().catch(console.error);
```

### 8.4 Refactor app.ts to accept context

Change `app.ts` to export a `createApp(context)` function:

```typescript
export function createApp(context: AppContext) {
  const app = new Hono<{ Variables: AppEnvVars }>();

  // Inject context middleware
  // Add auth middleware
  // Register routes (pass context or use middleware)
  // Return app

  return { app };
}
```

### 8.5 Update route handlers to use context

In each route handler, access dependencies via Hono context:

```typescript
app.get("/api/chats", async (c) => {
  const repo = c.get("repo");
  const { limit, offset } = c.req.query();
  const result = await repo.listChats({ limit: Number(limit) || 50, offset: Number(offset) || 0 });
  return c.json({ data: result.chats, total: result.total });
});
```

### 8.6 Handle graceful shutdown

In `packages/server/src/index.ts`:

```typescript
process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await context.clientManager.destroy();
  server.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await context.clientManager.destroy();
  server.close();
  process.exit(0);
});
```

### 8.7 Create data directory for SQLite

If using SQLite, ensure the data directory exists:

```typescript
import { mkdirSync } from "fs";
import { dirname } from "path";

if (config.db.driver === "sqlite" && config.db.sqlitePath) {
  mkdirSync(dirname(config.db.sqlitePath), { recursive: true });
}
```

### 8.8 End-to-end smoke test

1. Set up `.env` with SQLite driver and a test API key
2. Start server: `pnpm dev`
3. Create a chat: `curl -X POST http://localhost:3000/api/chats -H "Authorization: Bearer test-key" -H "Content-Type: application/json" -d '{"title":"Test"}'`
4. List chats: `curl http://localhost:3000/api/chats -H "Authorization: Bearer test-key"`
5. Connect WebSocket (using wscat or similar)
6. Send a message and verify Claude responds

## Output

- Server, database, and client all wired together
- Context injection working
- Graceful shutdown handling
- End-to-end flow from HTTP request to Claude response verified
