import { mysqlTable, varchar, text } from "drizzle-orm/mysql-core";

export const chats = mysqlTable("chats", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: text("title").notNull(),
  sessionId: varchar("session_id", { length: 36 }),
  userId: varchar("user_id", { length: 36 }).notNull().default("system"),
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

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const apiKeys = mysqlTable("api_keys", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  keyHash: varchar("key_hash", { length: 128 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
});
