import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, eq, desc, asc } from "drizzle-orm";
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
} from "@claude-chat/shared";
import { DEFAULT_CHAT_TITLE, DEFAULT_PAGE_SIZE } from "@claude-chat/shared";
import * as schema from "./schema-pg.js";

const { Pool } = pg;

export class PgRepository implements ChatRepository {
  private pool: pg.Pool;
  private db: ReturnType<typeof drizzle>;

  constructor(config: { connectionString: string }) {
    this.pool = new Pool({ connectionString: config.connectionString });
    this.db = drizzle(this.pool);
  }

  async init(): Promise<void> {
    // Initialize tables
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        session_id TEXT,
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
  }

  async createChat(input: CreateChatInput): Promise<Chat> {
    const now = new Date().toISOString();
    const chat: Chat = {
      id: randomUUID(),
      title: input.title || DEFAULT_CHAT_TITLE,
      sessionId: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(schema.chats).values({
      id: chat.id,
      title: chat.title,
      sessionId: chat.sessionId,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    });

    return chat;
  }

  async getChat(id: string): Promise<Chat | null> {
    const result = await this.db
      .select()
      .from(schema.chats)
      .where(eq(schema.chats.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      id: result[0].id,
      title: result[0].title,
      sessionId: result[0].sessionId,
      createdAt: result[0].createdAt,
      updatedAt: result[0].updatedAt,
    };
  }

  async listChats(params?: PaginationParams): Promise<{ chats: Chat[]; total: number }> {
    const limit = params?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = params?.offset ?? 0;

    const results = await this.db
      .select()
      .from(schema.chats)
      .orderBy(desc(schema.chats.updatedAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.chats);

    const chats: Chat[] = results.map((row) => ({
      id: row.id,
      title: row.title,
      sessionId: row.sessionId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return {
      chats,
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async updateChat(id: string, input: UpdateChatInput): Promise<Chat | null> {
    const existing = await this.getChat(id);
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
      .where(eq(schema.chats.id, id));

    return this.getChat(id);
  }

  async deleteChat(id: string): Promise<boolean> {
    const existing = await this.getChat(id);
    if (!existing) {
      return false;
    }

    // Delete messages first
    await this.db.delete(schema.messages).where(eq(schema.messages.chatId, id));

    // Delete chat
    await this.db.delete(schema.chats).where(eq(schema.chats.id, id));

    return true;
  }

  async setChatSession(chatId: string, sessionId: string): Promise<void> {
    const updatedAt = new Date().toISOString();

    await this.db
      .update(schema.chats)
      .set({
        sessionId,
        updatedAt,
      })
      .where(eq(schema.chats.id, chatId));
  }

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

    const messages: Message[] = results.map((row) => ({
      id: row.id,
      chatId: row.chatId,
      role: row.role as "user" | "assistant",
      content: JSON.parse(row.content) as MessageContent[],
      createdAt: row.createdAt,
      metadata: row.metadata ? (JSON.parse(row.metadata) as MessageMetadata) : undefined,
    }));

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
    return {
      id: row.id,
      chatId: row.chatId,
      role: row.role as "user" | "assistant",
      content: JSON.parse(row.content) as MessageContent[],
      createdAt: row.createdAt,
      metadata: row.metadata ? (JSON.parse(row.metadata) as MessageMetadata) : undefined,
    };
  }
}
