# 16 - Testing Strategy

## Goal

Define and implement testing for each package: unit tests, integration tests, and manual testing procedures.

## Steps

### 16.1 Install testing dependencies

At root level:

```bash
pnpm add -Dw vitest @testing-library/react @testing-library/jest-dom jsdom
```

### 16.2 Configure Vitest

Create `vitest.config.ts` at root (or per package):

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",  // or "jsdom" for UI
  },
});
```

### 16.3 Test @claude-chat/shared

- Verify types export correctly (compile-time only, no runtime tests needed)
- Test any utility functions or constants

### 16.4 Test @claude-chat/db

#### Unit tests for each repository implementation:

`packages/db/src/__tests__/sqlite-repository.test.ts`:
- Create in-memory SQLite DB (`:memory:`)
- Test CRUD operations: createChat, getChat, listChats, updateChat, deleteChat
- Test message operations: addMessage, getMessages
- Test session binding: setChatSession
- Test pagination: limit, offset
- Test ordering: chats by updatedAt DESC, messages by createdAt ASC
- Test cascade delete: deleting chat removes its messages
- Test not-found cases return null/false

`packages/db/src/__tests__/mongo-repository.test.ts`:
- Use `mongodb-memory-server` for isolated testing
- Same test suite as SQLite (test the interface, not the implementation)

PostgreSQL and MySQL tests:
- Skip by default (require running database)
- Can be enabled via env var: `TEST_PG=1`, `TEST_MYSQL=1`
- Use Docker containers in CI

### 16.5 Test @claude-chat/server

#### Unit tests:

`packages/server/src/__tests__/auth.test.ts`:
- Valid API key returns 200
- Missing API key returns 401
- Invalid API key returns 401
- Health endpoint bypasses auth

`packages/server/src/__tests__/routes/chats.test.ts`:
- Use Hono's test helper: `app.request("/api/chats")`
- Mock repository
- Test each REST endpoint: response status, body shape, error cases

#### Integration tests:

`packages/server/src/__tests__/integration.test.ts`:
- Start server with in-memory SQLite
- Test full flow: create chat -> list chats -> send message (mock client manager)
- WebSocket test: connect, send message, receive events

### 16.6 Test @claude-chat/client

`packages/client/src/__tests__/client-manager.test.ts`:
- Mock `@anthropic-ai/claude-agent-sdk` `query()` function
- Test sendMessage: verify correct options passed, callbacks invoked
- Test cancel: verify abort controller triggered
- Test session resumption: verify resume option passed
- Test image handling: verify multimodal message construction

### 16.7 Test @claude-chat/ui

`packages/ui/src/__tests__/`:
- Use `@testing-library/react` with jsdom environment
- Component tests:
  - `ChatList.test.tsx`: renders chats, search filters, create/delete callbacks
  - `ChatInput.test.tsx`: sends text, handles paste, validates images
  - `MessageBubble.test.tsx`: renders text, images, markdown
  - `ApiKeyModal.test.tsx`: validates input, calls onSubmit
- Hook tests:
  - `useAuth.test.ts`: localStorage persistence, logout clears key
  - `useChats.test.ts`: fetch, create, delete (mock fetch)

### 16.8 Add test scripts

In each `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Root `package.json`:

```json
{
  "scripts": {
    "test": "pnpm -r run test"
  }
}
```

### 16.9 Manual testing checklist

- [ ] Server starts with each DB driver (SQLite, Postgres, MySQL, MongoDB)
- [ ] Auth rejects invalid keys
- [ ] Create, list, update, delete chats via API
- [ ] WebSocket connects and streams messages
- [ ] UI shows chat list and creates new chats
- [ ] Multiple chat panels open simultaneously
- [ ] Image paste/upload works
- [ ] PWA installs on mobile Chrome
- [ ] Offline mode shows fallback
- [ ] App update notification appears

## Output

- Test suites for all packages
- CI-friendly test commands
- Manual testing checklist
- Mock strategy defined for external dependencies
