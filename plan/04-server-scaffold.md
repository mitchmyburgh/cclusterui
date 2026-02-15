# 04 - Hono Server Scaffold

## Goal

Set up the Hono server package with Node.js adapter, basic middleware, CORS, and health check.

## Steps

### 4.1 Install dependencies

```bash
cd packages/server
pnpm add hono @hono/node-server @hono/node-ws dotenv
pnpm add -D tsx @types/node
pnpm add @claude-chat/shared@workspace:* @claude-chat/db@workspace:* @claude-chat/client@workspace:*
```

### 4.2 Create server entry point

Create `packages/server/src/index.ts`:

```typescript
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { app } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Export upgradeWebSocket so routes can use it
export { upgradeWebSocket };

const server = serve({
  fetch: app.fetch,
  port: config.port,
  hostname: config.host,
}, (info) => {
  console.log(`Server running at http://${info.address}:${info.port}`);
});

injectWebSocket(server);
```

### 4.3 Create Hono app

Create `packages/server/src/app.ts`:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors({
  origin: ["http://localhost:5173"],  // Vite dev server
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
}));

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

export { app };
```

### 4.4 Create config loader

Create `packages/server/src/config.ts`:

```typescript
import "dotenv/config";

export interface ServerConfig {
  port: number;
  host: string;
  apiKeys: string[];
  anthropicApiKey: string;
  db: {
    driver: "sqlite" | "postgres" | "mysql" | "mongodb";
    sqlitePath?: string;
    postgresUrl?: string;
    mysqlUrl?: string;
    mongodbUrl?: string;
    mongodbName?: string;
  };
}

export function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "0.0.0.0",
    apiKeys: (process.env.API_KEYS || "").split(",").filter(Boolean),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    db: {
      driver: (process.env.DB_DRIVER as any) || "sqlite",
      sqlitePath: process.env.SQLITE_PATH || "./data/claude-chat.db",
      postgresUrl: process.env.POSTGRES_URL,
      mysqlUrl: process.env.MYSQL_URL,
      mongodbUrl: process.env.MONGODB_URL,
      mongodbName: process.env.MONGODB_NAME,
    },
  };
}
```

### 4.5 Add dev script

In `packages/server/package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

### 4.6 Create server tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### 4.7 Verify server starts

```bash
cd packages/server && pnpm dev
# Should see "Server running at http://0.0.0.0:3000"
# GET /health should return { "status": "ok" }
```

## Output

- Hono server running with Node.js adapter
- CORS configured for Vite dev server
- Request logging middleware
- Health check endpoint
- Config loaded from environment
- WebSocket support initialized
