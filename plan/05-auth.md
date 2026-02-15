# 05 - API Key Authentication

## Goal

Implement API key authentication middleware for the server and auth utilities for the UI.

## Steps

### 5.1 Create auth middleware

Create `packages/server/src/middleware/auth.ts`:

```typescript
import { createMiddleware } from "hono/factory";
import type { ServerConfig } from "../config.js";

// Hono middleware that validates Bearer token against API_KEYS env var
// - Extracts token from "Authorization: Bearer <token>" header
// - Also supports "token" query param (for WebSocket connections)
// - Compares against config.apiKeys array
// - Returns 401 JSON response if invalid:
//   { error: "Unauthorized", code: "INVALID_API_KEY", status: 401 }
// - Sets c.set("apiKey", token) on context for downstream use
// - Skips /health endpoint
```

### 5.2 Define Hono context variables

Create `packages/server/src/types.ts`:

```typescript
// Define Hono env type so c.get("apiKey") is typed
export type AppEnv = {
  Variables: {
    apiKey: string;
  };
};
```

### 5.3 Apply middleware to app

In `packages/server/src/app.ts`:

- Import auth middleware
- Apply to all `/api/*` routes
- Keep `/health` unprotected

```typescript
app.use("/api/*", authMiddleware(config));
```

### 5.4 Test auth manually

- `GET /api/chats` without auth -> 401
- `GET /api/chats` with `Authorization: Bearer valid-key` -> 200 (once routes exist)
- `GET /health` -> 200 (no auth needed)

## Output

- Server rejects unauthenticated requests to `/api/*`
- API key extracted and available in request context
- WebSocket auth via query param supported
- Health check remains public
