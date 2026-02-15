import { pgTable, text } from "drizzle-orm/pg-core";

export const chats = pgTable("chats", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  sessionId: text("session_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(), // JSON stringified
  createdAt: text("created_at").notNull(),
  metadata: text("metadata"), // JSON stringified, nullable
});
