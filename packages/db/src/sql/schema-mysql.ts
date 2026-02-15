import { mysqlTable, varchar, text } from "drizzle-orm/mysql-core";

export const chats = mysqlTable("chats", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: text("title").notNull(),
  sessionId: varchar("session_id", { length: 36 }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  chatId: varchar("chat_id", { length: 36 }).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(), // JSON stringified
  createdAt: text("created_at").notNull(),
  metadata: text("metadata"), // JSON stringified, nullable
});
