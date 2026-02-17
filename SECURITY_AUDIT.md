# Monorepo Security Audit Report

**Date:** 2026-02-16
**Scope:** Full security audit of all 7 packages in the `cclusterui` TypeScript monorepo
**Branch:** `main` (clean working tree)

## Stats

- **Packages audited:** 7 (root, client, db, server, shared, tui, ui)
- **Critical: 3** | **High: 11** | **Medium: 22** | **Low: 15**
- **Total findings: 51**

---

## Critical Findings

| #   | Finding                                                                                                                     | Package(s)              | File:Line                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------- |
| C1  | **No runtime validation** -- shared types are compile-time only; all WebSocket/API data cast without validation             | shared+server+client+ui | `shared/src/*`, `server/ws.ts:46,120`, `ui/useWebSocket.ts:33` |
| C2  | **JWT secret allows empty string** -- server starts with no functional auth when both `JWT_SECRET` and `API_KEYS` are unset | server                  | `config.ts:20-23`                                              |
| C3  | **`setChatSession` has no `userId` check** -- any authenticated user can bind their session to any chat                     | db (all 4 drivers)      | `sqlite-repo.ts:194-204`, `pg-repo.ts:198-208`                 |

### C1: No Runtime Validation

The shared package exports only TypeScript interfaces and constants with zero runtime validation. Types are erased at compilation. In the server, untrusted WebSocket data is `JSON.parse()`-ed and cast to shared types:

```typescript
// server/src/routes/ws.ts:46
const event: WSProducerEvent = JSON.parse(
  typeof evt.data === "string" ? evt.data : evt.data.toString(),
);
```

A malicious client can send any JSON payload and the server processes it as if it conforms to the type.

**Fix:** Add Zod schemas in shared package alongside types. Validate all inputs at trust boundaries.

### C2: JWT Secret Allows Empty String

```typescript
// server/src/config.ts:20-23
const jwtSecret = process.env.JWT_SECRET || "";
if (!jwtSecret) {
  console.warn("WARNING: JWT_SECRET not set. JWT auth will be disabled.");
}
```

**Fix:** Throw fatal error at startup if neither `JWT_SECRET` nor `API_KEYS` is configured.

### C3: `setChatSession` Missing Authorization

```typescript
// db/src/sql/sqlite-repository.ts:197-203
async setChatSession(chatId: string, sessionId: string): Promise<void> {
  await this.db.update(schema.chats)
    .set({ sessionId, updatedAt })
    .where(eq(schema.chats.id, chatId)); // No userId check
}
```

**Fix:** Add `userId` parameter and filter with `and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId))`.

---

## High Findings

| #   | Finding                                                                                                                                                  | Package(s)           | File:Line                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| H1  | **Default `bypassPermissions=true`** -- Claude Agent SDK runs unrestricted without `--hitl` flag; enables arbitrary code execution from prompt injection | client               | `claude-runner.ts:117-120`                                             |
| H2  | **No rate limiting on auth endpoints** -- unlimited brute-force attacks on login/register                                                                | server               | `routes/auth.ts:9,77`                                                  |
| H3  | **Auth tokens leaked in WebSocket `?token=` query parameter** -- visible in server logs, proxy logs, Referer headers, browser history                    | server+client+tui+ui | `middleware/auth.ts:23-25`, `local-client.ts:81`, `useWebSocket.ts:12` |
| H4  | **`toolInput: unknown` relayed to viewers without sanitization** -- enables prototype pollution and potential XSS                                        | shared+server        | `ws.ts:8,34`, `server/ws.ts:56-58`                                     |
| H5  | **Unrestricted `imageData` base64** -- `MAX_IMAGE_SIZE`/`ALLOWED_IMAGE_TYPES` defined but never enforced server-side                                     | shared+server        | `message.ts:3-8`                                                       |
| H6  | **CLI credentials visible in process list** -- `--api-key`, `--password`, `--anthropic-key` exposed via `ps aux`                                         | client               | `cli.ts:13-16`                                                         |
| H7  | **Docker container runs as root** -- no USER directive in runtime stage                                                                                  | root                 | `Dockerfile:29-49`                                                     |
| H8  | **`getMessage(id)` IDOR** -- retrieves any message without ownership check                                                                               | db (all 4 drivers)   | `repository.ts:33`, `sqlite-repo.ts:277-297`                           |
| H9  | **No SSL/TLS enforcement on database connections** -- credentials/data transmitted in cleartext                                                          | db                   | `pg-repo.ts:27`, `mysql-repo.ts:25`, `mongo-repo.ts:63`                |
| H10 | **Auth token stored in `localStorage` without protection** -- vulnerable to XSS-based token theft                                                        | ui                   | `storage.ts:15-16`                                                     |
| H11 | **PWA service worker caches authenticated API responses** -- cached data persists after logout                                                           | ui                   | `vite.config.ts:29-37`                                                 |

### H1: Unrestricted Agent Permissions

```typescript
// client/src/claude-runner.ts:117-120
} else {
  queryOptions.permissionMode = "bypassPermissions";
  queryOptions.allowDangerouslySkipPermissions = true;
}
```

Without `--hitl`, the agent can execute arbitrary shell commands, write any file, and perform web operations. A compromised server or prompt injection triggers unrestricted code execution.

**Fix:** Default to HITL mode. Require explicit `--no-hitl` flag with confirmation warning. Sandbox filesystem access.

### H2: No Rate Limiting

**Fix:** Add rate limiting middleware to `/api/auth/*` routes (e.g., 10 attempts per 15 minutes).

### H3: Token in WebSocket Query Parameter

```typescript
// client/src/local-client.ts:81
const url = `${wsUrl}/api/chats/${chatId}/ws?token=${encodeURIComponent(apiKey)}&role=producer`;

// ui/src/hooks/useWebSocket.ts:12
const wsUrl = `${protocol}//${window.location.host}/api/chats/${chatId}/ws?token=${encodeURIComponent(apiKey)}&role=viewer`;
```

**Fix:** Use WebSocket handshake headers or implement short-lived single-use ticket exchange.

### H4: Unsanitized `toolInput` Relay

```typescript
// server/src/routes/ws.ts:56-58
if (event.type === "tool_approval_request") {
  connectionManager.broadcastToViewers(
    chatId,
    event as unknown as WSServerToViewerEvent,
  );
  return;
}
```

**Fix:** Constrain `toolInput` type, strip `__proto__`/`constructor` keys, enforce size limits.

### H5: Unrestricted Image Data

`MAX_IMAGE_SIZE` (10MB) and `ALLOWED_IMAGE_TYPES` are defined in `shared/constants.ts` but never enforced in the server.

**Fix:** Export and call `validateMessageContent()` before persistence.

### H6: CLI Credentials in Process List

```typescript
// client/src/cli.ts:13-16
.option("--api-key <key>", "API key or JWT token")
.option("--password <password>", "Login password")
.option("--anthropic-key <key>", "Anthropic API key")
```

**Fix:** Accept secrets via environment variables only. Use stdin prompt for passwords.

### H7: Docker Runs as Root

**Fix:** Add non-root user to Dockerfile runtime stage:

```dockerfile
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser
```

### H8: `getMessage` IDOR

`getMessage(id)` retrieves any message without ownership check. Any caller who knows a message ID can read full content.

**Fix:** Add `userId` parameter, join/validate against parent chat's `userId`.

### H9: No Database SSL/TLS

```typescript
// db/src/sql/pg-repository.ts:27
this.pool = new Pool({ connectionString: config.connectionString });
// No ssl: { rejectUnauthorized: true }
```

**Fix:** Add SSL config to `DbConfig`. Default to requiring SSL in production.

### H10: Token in localStorage

```typescript
// ui/src/lib/storage.ts:15-16
export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}
```

Accessible to any JS on the same origin. One XSS vulnerability = full token theft.

**Fix:** Use `httpOnly` secure cookies or `sessionStorage` with short-lived token rotation.

### H11: PWA Caches Auth Data

```typescript
// ui/vite.config.ts:29-37
runtimeCaching: [
  {
    urlPattern: /^\/api\/.*/i,
    handler: "NetworkFirst",
    options: { cacheName: "api-cache", expiration: { maxAgeSeconds: 3600 } },
  },
];
```

**Fix:** Exclude sensitive endpoints from caching. Clear `api-cache` on logout.

---

## Cross-Package Concerns

1. **No runtime validation anywhere.** `@mitchmyburgh/shared` provides types only. Server, client, TUI, and UI all cast parsed JSON without validation. Every WebSocket message and API request bypasses type safety at runtime.

2. **Token leakage is systemic (4 packages).** Client (`local-client.ts:81`), TUI, UI (`useWebSocket.ts:12`), and server (`middleware/auth.ts:23-25`) all use query-parameter tokens for WebSocket auth. Fixing requires coordinated changes across all 4 packages.

3. **Authorization gaps between server and db layers.** Server routes enforce `userId` on most operations, but the db `ChatRepository` has methods (`setChatSession`, `getMessage`, `getMessages`, `addMessage`) that skip ownership checks. The server's WebSocket handler calls `setChatSession` without re-verifying ownership.

4. **Unrestricted client execution + full env exposure.** `client/claude-runner.ts:74-77` spreads entire `process.env` into agent environment. Combined with H1 (bypassed permissions), a compromised server can exfiltrate all environment secrets.

5. **Error message leakage at every layer.** Server HTTP handler (`app.ts:61-67`), server WebSocket handler (`ws.ts:176-181`), client error handler (`local-client.ts:173-176`), and UI (`LoginForm.tsx:39`, `api.ts:21`) all propagate raw error details.

6. **Post-logout data persistence.** UI stores token in `localStorage` (H10) and PWA caches API responses (H11). After logout, sensitive chat data and credentials remain accessible on the device.

7. **Mass assignment via shared types.** `CreateChatInput.userId` and `UpdateChatInput` body pass-through allow clients to inject arbitrary fields.

8. **Stale `.npmrc` scope** creates supply chain risk (`@claude-chat` mapped but packages are `@mitchmyburgh`).

---

## Medium Findings

| #   | Finding                                                             | Package       | File:Line                              |
| --- | ------------------------------------------------------------------- | ------------- | -------------------------------------- |
| M1  | Error handler leaks `err.message` to clients                        | server        | `app.ts:61-67`                         |
| M2  | CORS hardcoded to `localhost:5173`                                  | server        | `app.ts:19-26`                         |
| M3  | JWT tokens expire in 30 days, no revocation                         | server        | `auth.ts:60,117`                       |
| M4  | No JWT invalidation on password change                              | server        | `middleware/auth.ts:35-51`             |
| M5  | Timing-unsafe API key comparison via `Array.includes()`             | server        | `middleware/auth.ts:73`                |
| M6  | Missing security headers (CSP, HSTS, X-Frame-Options)               | server        | `app.ts` (global)                      |
| M7  | No input validation on chat create/update bodies                    | server        | `routes/chats.ts:17-22,35-42`          |
| M8  | No validation on WebSocket message content size                     | server        | `routes/ws.ts:124-133`                 |
| M9  | `CreateChatInput.userId` allows user ID override                    | shared        | `types/chat.ts:10-13`                  |
| M10 | Mass assignment via unfiltered `UpdateChatInput` body               | shared+server | `chat.ts:15-17`, `chats.ts:38`         |
| M11 | Entire `process.env` forwarded to Claude Agent SDK                  | client        | `claude-runner.ts:74-77`               |
| M12 | Login request sent over potentially insecure HTTP                   | client        | `cli.ts:30-34`                         |
| M13 | Stale `.npmrc` scope mapping -- supply chain risk                   | root          | `.npmrc:1`                             |
| M14 | Unbounded pagination `limit` (DoS via `?limit=999999999`)           | server        | `routes/chats.ts:10`, `messages.ts:18` |
| M15 | No HEALTHCHECK in Dockerfile                                        | root          | `Dockerfile:29-49`                     |
| M16 | CI/CD uses mutable action version tags (not SHA-pinned)             | root          | `ci.yml:13-62`                         |
| M17 | `getMessages(chatId)` no `userId` check                             | db            | `repository.ts:29-32`                  |
| M18 | `addMessage(chatId)` no `userId` check -- enables message injection | db            | `repository.ts:23-28`                  |
| M19 | Unsafe `JSON.parse()` without try/catch on db content               | db            | `sqlite-repo.ts:266-268`               |
| M20 | Raw API key displayed in DOM with no auto-dismiss timeout           | ui            | `ApiKeyManager.tsx:38,65`              |
| M21 | Unvalidated `chatId` used in URL path construction                  | ui            | `useWebSocket.ts:12`, `api.ts:41`      |
| M22 | No CSP meta tag or headers defined in UI                            | ui            | `index.html`                           |

---

## Low Findings

| #   | Finding                                                 | Package       | File:Line                       |
| --- | ------------------------------------------------------- | ------------- | ------------------------------- |
| L1  | WebSocket role is user-controlled                       | server        | `routes/ws.ts:14`               |
| L2  | WebSocket error messages broadcast internal details     | server        | `routes/ws.ts:176-181`          |
| L3  | User enumeration via different registration error codes | server        | `routes/auth.ts:37-50`          |
| L4  | Non-exhaustive WebSocket event type handling            | shared+server | `ws.ts:20-23`                   |
| L5  | `.env.example` contains realistic placeholder creds     | root          | `.env.example:2,14,17`          |
| L6  | No server-sent WS message validation in client          | client        | `local-client.ts:96-98`         |
| L7  | Client error messages leak details to server            | client        | `local-client.ts:173-176`       |
| L8  | README documents insecure example creds (`changeme`)    | root          | `README.md:135-144`             |
| L9  | Default bind to `0.0.0.0` in dev                        | root          | `.env.example:24`               |
| L10 | Source maps shipped to production Docker image          | root          | `tsconfig.base.json:14`         |
| L11 | No foreign key constraints or cascade deletes           | db            | `sqlite-repo.ts:29-72`          |
| L12 | No `close()` method on repository -- connection leak    | db            | All repository classes          |
| L13 | WebSocket silently ignores JSON parse errors            | ui            | `useWebSocket.ts:30-35`         |
| L14 | Server error messages rendered directly in UI           | ui            | `LoginForm.tsx:39`, `api.ts:21` |
| L15 | `useState` misused for data fetching side effect        | ui            | `AppLayout.tsx:18-21`           |

---

## Positive Findings

- **No SQL injection** -- Drizzle ORM with parameterized queries; no string interpolation in queries
- **No NoSQL injection** -- MongoDB uses typed exact-match queries
- **No XSS via `dangerouslySetInnerHTML`** -- not used anywhere; `react-markdown` builds React elements from AST
- **No `rehype-raw` plugin** -- markdown cannot pass through raw HTML
- **No command injection** -- no `exec`/`spawn` in server, db, or shared
- **No hardcoded secrets** -- all secrets via env vars; `.env` in `.gitignore`
- **Good password hashing** -- bcryptjs cost factor 10; hash stored, plaintext never persisted
- **Good API key design** -- SHA-256 hashed, prefix-only stored, revocation supported
- **UUID primary keys** -- `crypto.randomUUID()` prevents ID guessing
- **`getUserById` excludes `passwordHash`** from response
- **Image upload validation in UI** -- validates MIME type and size client-side
- **Multi-stage Docker build** -- source code not in final image
- **`--frozen-lockfile`** in CI and Docker
- **`onlyBuiltDependencies`** limits native build scripts to `better-sqlite3`
- **`private: true`** prevents accidental root package publication
- **Least-privilege CI permissions** -- scoped per job
- **`--access restricted`** on npm publish
- **Strict TypeScript** -- `"strict": true` enabled

---

## Remediation Roadmap

### Immediate (this week)

1. Add `userId` to `setChatSession` across all db drivers (C3)
2. Fix `.npmrc` stale scope (M13) -- one-line fix
3. Add Zod runtime validation in shared package (C1)
4. Require auth config at startup (C2)
5. Default to HITL mode in client (H1)
6. Add `USER appuser` to Dockerfile (H7)
7. Clear PWA `api-cache` on logout (H11)

### Short-term (weeks 2-3)

8. Fix token transport -- WS headers or ticket exchange (H3) -- coordinated across 4 packages
9. Add `userId` to `getMessage`/`getMessages`/`addMessage` in db (H8, M17, M18)
10. Add SSL/TLS config for db connections (H9)
11. Rate limiting on auth endpoints (H2)
12. Restrict `process.env` forwarding (M11)
13. Pin GitHub Actions to SHAs (M16)
14. Add `secureHeaders()` middleware (M6)
15. Move token to `httpOnly` cookies or `sessionStorage` (H10)

### Medium-term (month 2)

16. Input validation on all endpoints (M7, M8, H4, H5, M14)
17. JWT improvements -- shorter expiry, refresh tokens, revocation (M3, M4)
18. Timing-safe API key comparison (M5)
19. CORS configurability (M2)
20. CSP headers (M22)
21. Add foreign key constraints (L11)
22. Add `close()` to `ChatRepository` (L12)
