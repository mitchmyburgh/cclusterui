import Database from "better-sqlite3";
import { SqliteRepository } from "../sql/sqlite-repository.js";
import type { Chat, Message } from "@claude-chat/shared";

describe("SqliteRepository", () => {
  let db: Database.Database;
  let repo: SqliteRepository;

  beforeEach(() => {
    // Create in-memory database for each test
    db = new Database(":memory:");
    repo = new (SqliteRepository as any)({ path: ":memory:" });
    // Override the sqlite instance to use our in-memory db
    (repo as any).sqlite = db;

    // Re-initialize tables with our db instance
    db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        session_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata TEXT
      )
    `);
  });

  afterEach(() => {
    db.close();
  });

  describe("Chat CRUD operations", () => {
    it("should create a chat", async () => {
      const chat = await repo.createChat({ title: "Test Chat" });

      expect(chat).toBeDefined();
      expect(chat.id).toBeDefined();
      expect(chat.title).toBe("Test Chat");
      expect(chat.sessionId).toBeNull();
      expect(chat.createdAt).toBeDefined();
      expect(chat.updatedAt).toBeDefined();
    });

    it("should create a chat with default title", async () => {
      const chat = await repo.createChat({});

      expect(chat.title).toBe("New Chat");
    });

    it("should get a chat by id", async () => {
      const created = await repo.createChat({ title: "Test Chat" });
      const retrieved = await repo.getChat(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe("Test Chat");
    });

    it("should return null for non-existent chat", async () => {
      const chat = await repo.getChat("non-existent-id");

      expect(chat).toBeNull();
    });

    it("should list chats", async () => {
      await repo.createChat({ title: "Chat 1" });
      await repo.createChat({ title: "Chat 2" });
      await repo.createChat({ title: "Chat 3" });

      const result = await repo.listChats();

      expect(result.chats).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("should list chats with pagination", async () => {
      await repo.createChat({ title: "Chat 1" });
      await repo.createChat({ title: "Chat 2" });
      await repo.createChat({ title: "Chat 3" });

      const result = await repo.listChats({ limit: 2, offset: 1 });

      expect(result.chats).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it("should update a chat", async () => {
      const chat = await repo.createChat({ title: "Original Title" });
      // Small delay to ensure updatedAt changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = await repo.updateChat(chat.id, { title: "Updated Title" });

      expect(updated).toBeDefined();
      expect(updated?.title).toBe("Updated Title");
      expect(updated?.updatedAt).not.toBe(chat.updatedAt);
    });

    it("should return null when updating non-existent chat", async () => {
      const result = await repo.updateChat("non-existent-id", { title: "Test" });

      expect(result).toBeNull();
    });

    it("should delete a chat and return true", async () => {
      const chat = await repo.createChat({ title: "Test Chat" });
      const deleted = await repo.deleteChat(chat.id);

      expect(deleted).toBe(true);

      const retrieved = await repo.getChat(chat.id);
      expect(retrieved).toBeNull();
    });

    it("should return false when deleting non-existent chat", async () => {
      const deleted = await repo.deleteChat("non-existent-id");

      expect(deleted).toBe(false);
    });

    it("should set chat session", async () => {
      const chat = await repo.createChat({ title: "Test Chat" });
      await repo.setChatSession(chat.id, "session-123");

      const retrieved = await repo.getChat(chat.id);
      expect(retrieved?.sessionId).toBe("session-123");
    });
  });

  describe("Message operations", () => {
    let chatId: string;

    beforeEach(async () => {
      const chat = await repo.createChat({ title: "Test Chat" });
      chatId = chat.id;
    });

    it("should add a message", async () => {
      const message = await repo.addMessage(chatId, "user", [
        { type: "text", text: "Hello" },
      ]);

      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.chatId).toBe(chatId);
      expect(message.role).toBe("user");
      expect(message.content).toEqual([{ type: "text", text: "Hello" }]);
      expect(message.createdAt).toBeDefined();
    });

    it("should add a message with metadata", async () => {
      const message = await repo.addMessage(
        chatId,
        "assistant",
        [{ type: "text", text: "Hi there" }],
        { model: "claude-3-opus-20240229" }
      );

      expect(message.metadata).toEqual({ model: "claude-3-opus-20240229" });
    });

    it("should get messages for a chat", async () => {
      await repo.addMessage(chatId, "user", [{ type: "text", text: "Message 1" }]);
      await repo.addMessage(chatId, "assistant", [{ type: "text", text: "Message 2" }]);

      const result = await repo.getMessages(chatId);

      expect(result.messages).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.messages[0].content[0].text).toBe("Message 1");
      expect(result.messages[1].content[0].text).toBe("Message 2");
    });

    it("should get messages with pagination", async () => {
      await repo.addMessage(chatId, "user", [{ type: "text", text: "Message 1" }]);
      await repo.addMessage(chatId, "assistant", [{ type: "text", text: "Message 2" }]);
      await repo.addMessage(chatId, "user", [{ type: "text", text: "Message 3" }]);

      const result = await repo.getMessages(chatId, { limit: 2, offset: 1 });

      expect(result.messages).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it("should delete messages when chat is deleted", async () => {
      await repo.addMessage(chatId, "user", [{ type: "text", text: "Message 1" }]);
      await repo.addMessage(chatId, "assistant", [{ type: "text", text: "Message 2" }]);

      await repo.deleteChat(chatId);

      const result = await repo.getMessages(chatId);
      expect(result.messages).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
