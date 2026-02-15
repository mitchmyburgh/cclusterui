import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  sessionId: text("session_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(), // JSON stringified
  createdAt: text("created_at").notNull(),
  metadata: text("metadata"), // JSON stringified, nullable
});
