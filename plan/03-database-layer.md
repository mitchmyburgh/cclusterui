# 03 - Database Abstraction Layer

## Goal

Create `@claude-chat/db` package that supports SQLite, PostgreSQL, MySQL (via Drizzle ORM), and MongoDB (via native driver) behind a unified repository interface.

## Steps

### 3.1 Install dependencies

```bash
cd packages/db
pnpm add drizzle-orm better-sqlite3 pg mysql2 mongodb uuid
pnpm add -D drizzle-kit @types/better-sqlite3 @types/pg @types/uuid
```

### 3.2 Define the repository interface

Create `packages/db/src/repository.ts`:

```typescript
import type { Chat, CreateChatInput, UpdateChatInput, Message, SendMessageInput, PaginationParams } from "@claude-chat/shared";

export interface ChatRepository {
  // Chat CRUD
  createChat(input: CreateChatInput): Promise<Chat>;
  getChat(id: string): Promise<Chat | null>;
  listChats(params?: PaginationParams): Promise<{ chats: Chat[]; total: number }>;
  updateChat(id: string, input: UpdateChatInput): Promise<Chat | null>;
  deleteChat(id: string): Promise<boolean>;

  // Session binding
  setChatSession(chatId: string, sessionId: string): Promise<void>;

  // Messages
  addMessage(chatId: string, role: "user" | "assistant", content: MessageContent[], metadata?: MessageMetadata): Promise<Message>;
  getMessages(chatId: string, params?: PaginationParams): Promise<{ messages: Message[]; total: number }>;
  getMessage(id: string): Promise<Message | null>;
}
```

### 3.3 Define Drizzle schema for SQL databases

Create `packages/db/src/sql/schema.ts`:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
// Also define pgTable and mysqlTable variants

// Chats table
// Columns: id (text PK), title (text), session_id (text nullable),
//          created_at (text ISO), updated_at (text ISO)

// Messages table
// Columns: id (text PK), chat_id (text FK), role (text),
//          content (text JSON), created_at (text ISO),
//          metadata (text JSON nullable)
```

Note: Drizzle requires separate schema definitions for each dialect. Create three files:
- `packages/db/src/sql/schema-sqlite.ts`
- `packages/db/src/sql/schema-pg.ts`
- `packages/db/src/sql/schema-mysql.ts`

These are structurally identical but use dialect-specific table builders (`sqliteTable`, `pgTable`, `mysqlTable`).

### 3.4 Implement SQLite repository

Create `packages/db/src/sql/sqlite-repository.ts`:

- Import `drizzle` from `drizzle-orm/better-sqlite3`
- Import schema from `./schema-sqlite`
- Implement `ChatRepository` interface
- Constructor takes `{ path: string }` config
- On construction: create drizzle instance, run migrations
- `createChat`: insert with `uuid()` for ID, default title
- `getChat`: select where id = param
- `listChats`: select with order by updated_at DESC, limit/offset
- `updateChat`: update where id = param, set updated_at
- `deleteChat`: delete messages first (FK), then delete chat
- `setChatSession`: update session_id on chat row
- `addMessage`: insert message row with JSON-stringified content
- `getMessages`: select where chat_id, order by created_at ASC
- `getMessage`: select where id = param

### 3.5 Implement PostgreSQL repository

Create `packages/db/src/sql/pg-repository.ts`:

- Import `drizzle` from `drizzle-orm/node-postgres`
- Use `pg` Pool for connection
- Same implementation pattern as SQLite
- Constructor takes `{ connectionString: string }`
- Handle connection pooling

### 3.6 Implement MySQL repository

Create `packages/db/src/sql/mysql-repository.ts`:

- Import `drizzle` from `drizzle-orm/mysql2`
- Use `mysql2/promise` pool
- Same implementation pattern
- Constructor takes `{ connectionString: string }`

### 3.7 Implement MongoDB repository

Create `packages/db/src/mongo/mongo-repository.ts`:

- Import `MongoClient` from `mongodb`
- Use two collections: `chats` and `messages`
- Map document shape to `Chat`/`Message` types
- Constructor takes `{ connectionString: string, dbName?: string }`
- On construction: connect client, get db reference
- `createChat`: insertOne with generated UUID
- `getChat`: findOne by `_id` mapped to `id`
- `listChats`: find().sort({ updatedAt: -1 }).skip().limit()
- `updateChat`: findOneAndUpdate with $set
- `deleteChat`: deleteMany messages, deleteOne chat
- `addMessage`: insertOne to messages collection
- `getMessages`: find({ chatId }).sort({ createdAt: 1 })
- Create indexes: `messages.chatId`, `chats.updatedAt`

### 3.8 Create migration files for SQL

Create `packages/db/src/sql/migrations/`:

- `0001_create_chats.sql` - CREATE TABLE for chats
- `0002_create_messages.sql` - CREATE TABLE for messages with FK

Use Drizzle Kit to generate these:
```bash
pnpm drizzle-kit generate
```

Provide three `drizzle.config.ts` variants or a single one parameterized by `DB_DRIVER`.

### 3.9 Create database factory

Create `packages/db/src/factory.ts`:

```typescript
import type { ChatRepository } from "./repository.js";

export type DbDriver = "sqlite" | "postgres" | "mysql" | "mongodb";

export interface DbConfig {
  driver: DbDriver;
  // SQLite
  sqlitePath?: string;
  // Postgres
  postgresUrl?: string;
  // MySQL
  mysqlUrl?: string;
  // MongoDB
  mongodbUrl?: string;
  mongodbName?: string;
}

export async function createRepository(config: DbConfig): Promise<ChatRepository> {
  switch (config.driver) {
    case "sqlite": {
      const { SqliteRepository } = await import("./sql/sqlite-repository.js");
      return new SqliteRepository({ path: config.sqlitePath! });
    }
    case "postgres": {
      const { PgRepository } = await import("./sql/pg-repository.js");
      return new PgRepository({ connectionString: config.postgresUrl! });
    }
    case "mysql": {
      const { MysqlRepository } = await import("./sql/mysql-repository.js");
      return new MysqlRepository({ connectionString: config.mysqlUrl! });
    }
    case "mongodb": {
      const { MongoRepository } = await import("./mongo/mongo-repository.js");
      return new MongoRepository({
        connectionString: config.mongodbUrl!,
        dbName: config.mongodbName,
      });
    }
  }
}
```

### 3.10 Create barrel export

Create `packages/db/src/index.ts`:

```typescript
export { createRepository } from "./factory.js";
export type { ChatRepository } from "./repository.js";
export type { DbConfig, DbDriver } from "./factory.js";
```

### 3.11 Add @claude-chat/shared as workspace dependency

In `packages/db/package.json`:

```json
{
  "dependencies": {
    "@claude-chat/shared": "workspace:*"
  }
}
```

### 3.12 Build and verify types

```bash
cd packages/db && pnpm build
```

## Output

- Unified `ChatRepository` interface
- Working implementations for SQLite, PostgreSQL, MySQL, MongoDB
- Factory function to create the correct repository from config
- Database migrations for SQL dialects
- All implementations tested against the same interface
