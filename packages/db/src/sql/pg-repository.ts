import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, eq, desc, asc, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { ChatRepository } from "../repository.js";
import type {
  Chat,
  CreateChatInput,
  UpdateChatInput,
  Message,
  MessageContent,
  MessageMetadata,
  PaginationParams,
  User,
  ApiKey,
} from "@mitchmyburgh/shared";
import { DEFAULT_CHAT_TITLE, DEFAULT_PAGE_SIZE } from "@mitchmyburgh/shared";
import * as schema from "./schema-pg.js";

const { Pool } = pg;

export class PgRepository implements ChatRepository {
  private pool: pg.Pool;
  private db: ReturnType<typeof drizzle>;

  constructor(config: { connectionString: string; ssl?: boolean }) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      ...(config.ssl !== false ? { ssl: { rejectUnauthorized: true } } : {}),
    });
    this.db = drizzle(this.pool);
  }

  async init(): Promise<void> {
    // Initialize tables
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        session_id TEXT,
        user_id TEXT NOT NULL DEFAULT 'system',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata TEXT
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT
      )
    `);

    // Migration: add user_id to chats if missing
    try {
      await this.pool.query(`ALTER TABLE chats ADD COLUMN user_id TEXT NOT NULL DEFAULT 'system'`);
    } catch {
      // Column already exists
    }
  }

  // Chat operations

  async createChat(input: CreateChatInput, userId: string): Promise<Chat> {
    const now = new Date().toISOString();
    const chat: Chat = {
      id: randomUUID(),
      title: input.title || DEFAULT_CHAT_TITLE,
      sessionId: null,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(schema.chats).values({
      id: chat.id,
      title: chat.title,
      sessionId: chat.sessionId,
      userId: chat.userId,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    });

    return chat;
  }

  async getChat(id: string, userId: string): Promise<Chat | null> {
    const result = await this.db
      .select()
      .from(schema.chats)
      .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      id: result[0].id,
      title: result[0].title,
      sessionId: result[0].sessionId,
      userId: result[0].userId,
      createdAt: result[0].createdAt,
      updatedAt: result[0].updatedAt,
    };
  }

  async listChats(userId: string, params?: PaginationParams): Promise<{ chats: Chat[]; total: number }> {
    const limit = params?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = params?.offset ?? 0;

    const results = await this.db
      .select()
      .from(schema.chats)
      .where(eq(schema.chats.userId, userId))
      .orderBy(desc(schema.chats.updatedAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.chats)
      .where(eq(schema.chats.userId, userId));

    const chats: Chat[] = results.map((row) => ({
      id: row.id,
      title: row.title,
      sessionId: row.sessionId,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return {
      chats,
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async updateChat(id: string, userId: string, input: UpdateChatInput): Promise<Chat | null> {
    const existing = await this.getChat(id, userId);
    if (!existing) {
      return null;
    }

    const updatedAt = new Date().toISOString();

    await this.db
      .update(schema.chats)
      .set({
        title: input.title ?? existing.title,
        updatedAt,
      })
      .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, userId)));

    return this.getChat(id, userId);
  }

  async deleteChat(id: string, userId: string): Promise<boolean> {
    const existing = await this.getChat(id, userId);
    if (!existing) {
      return false;
    }

    // Delete messages first
    await this.db.delete(schema.messages).where(eq(schema.messages.chatId, id));

    // Delete chat
    await this.db.delete(schema.chats).where(and(eq(schema.chats.id, id), eq(schema.chats.userId, userId)));

    return true;
  }

  async setChatSession(chatId: string, sessionId: string, userId: string): Promise<void> {
    const updatedAt = new Date().toISOString();

    await this.db
      .update(schema.chats)
      .set({
        sessionId,
        updatedAt,
      })
      .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)));
  }

  // Message operations

  async addMessage(
    chatId: string,
    role: "user" | "assistant",
    content: MessageContent[],
    metadata?: MessageMetadata
  ): Promise<Message> {
    const now = new Date().toISOString();
    const message: Message = {
      id: randomUUID(),
      chatId,
      role,
      content,
      createdAt: now,
      metadata,
    };

    await this.db.insert(schema.messages).values({
      id: message.id,
      chatId: message.chatId,
      role: message.role,
      content: JSON.stringify(message.content),
      createdAt: message.createdAt,
      metadata: message.metadata ? JSON.stringify(message.metadata) : null,
    });

    // Update chat's updatedAt
    await this.db
      .update(schema.chats)
      .set({ updatedAt: now })
      .where(eq(schema.chats.id, chatId));

    return message;
  }

  async getMessages(
    chatId: string,
    params?: PaginationParams
  ): Promise<{ messages: Message[]; total: number }> {
    const limit = params?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = params?.offset ?? 0;

    const results = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.chatId, chatId))
      .orderBy(asc(schema.messages.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.messages)
      .where(eq(schema.messages.chatId, chatId));

    const messages: Message[] = results.map((row) => {
      let content: MessageContent[] = [];
      let metadata: MessageMetadata | undefined;
      try { content = JSON.parse(row.content) as MessageContent[]; } catch { /* invalid JSON */ }
      try { metadata = row.metadata ? (JSON.parse(row.metadata) as MessageMetadata) : undefined; } catch { /* invalid JSON */ }
      return {
        id: row.id,
        chatId: row.chatId,
        role: row.role as "user" | "assistant",
        content,
        createdAt: row.createdAt,
        metadata,
      };
    });

    return {
      messages,
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async getMessage(id: string): Promise<Message | null> {
    const result = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    let content: MessageContent[] = [];
    let metadata: MessageMetadata | undefined;
    try { content = JSON.parse(row.content) as MessageContent[]; } catch { /* invalid JSON */ }
    try { metadata = row.metadata ? (JSON.parse(row.metadata) as MessageMetadata) : undefined; } catch { /* invalid JSON */ }
    return {
      id: row.id,
      chatId: row.chatId,
      role: row.role as "user" | "assistant",
      content,
      createdAt: row.createdAt,
      metadata,
    };
  }

  // User operations

  async createUser(username: string, passwordHash: string): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      username,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(schema.users).values({
      id: user.id,
      username: user.username,
      passwordHash,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

    return user;
  }

  async getUserByUsername(username: string): Promise<(User & { passwordHash: string }) | null> {
    const result = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (result.length === 0) return null;

    return {
      id: result[0].id,
      username: result[0].username,
      passwordHash: result[0].passwordHash,
      createdAt: result[0].createdAt,
      updatedAt: result[0].updatedAt,
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (result.length === 0) return null;

    return {
      id: result[0].id,
      username: result[0].username,
      createdAt: result[0].createdAt,
      updatedAt: result[0].updatedAt,
    };
  }

  // API key operations

  async createApiKey(userId: string, keyHash: string, keyPrefix: string, name: string): Promise<ApiKey> {
    const now = new Date().toISOString();
    const apiKey: ApiKey = {
      id: randomUUID(),
      userId,
      name,
      keyPrefix,
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    };

    await this.db.insert(schema.apiKeys).values({
      id: apiKey.id,
      userId: apiKey.userId,
      keyHash,
      keyPrefix: apiKey.keyPrefix,
      name: apiKey.name,
      createdAt: apiKey.createdAt,
      lastUsedAt: null,
      revokedAt: null,
    });

    return apiKey;
  }

  async getApiKeyByHash(keyHash: string): Promise<(ApiKey & { userId: string }) | null> {
    const result = await this.db
      .select()
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.keyHash, keyHash), isNull(schema.apiKeys.revokedAt)))
      .limit(1);

    if (result.length === 0) return null;

    return {
      id: result[0].id,
      userId: result[0].userId,
      name: result[0].name,
      keyPrefix: result[0].keyPrefix,
      createdAt: result[0].createdAt,
      lastUsedAt: result[0].lastUsedAt,
      revokedAt: result[0].revokedAt,
    };
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    const results = await this.db
      .select()
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.userId, userId))
      .orderBy(desc(schema.apiKeys.createdAt));

    return results.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      keyPrefix: row.keyPrefix,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
      revokedAt: row.revokedAt,
    }));
  }

  async revokeApiKey(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .select()
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.userId, userId)))
      .limit(1);

    if (result.length === 0) return false;

    await this.db
      .update(schema.apiKeys)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(schema.apiKeys.id, id));

    return true;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await this.db
      .update(schema.apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(schema.apiKeys.id, id));
  }
}
