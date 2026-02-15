import { SqliteRepository } from "../sql/sqlite-repository.js";

describe("SqliteRepository", () => {
  let repo: SqliteRepository;
  const testUserId = "test-user-id";

  beforeEach(() => {
    repo = new SqliteRepository({ path: ":memory:" });
  });

  describe("Chat CRUD operations", () => {
    it("should create a chat", async () => {
      const chat = await repo.createChat({ title: "Test Chat" }, testUserId);

      expect(chat).toBeDefined();
      expect(chat.id).toBeDefined();
      expect(chat.title).toBe("Test Chat");
      expect(chat.sessionId).toBeNull();
      expect(chat.userId).toBe(testUserId);
      expect(chat.createdAt).toBeDefined();
      expect(chat.updatedAt).toBeDefined();
    });

    it("should create a chat with default title", async () => {
      const chat = await repo.createChat({}, testUserId);

      expect(chat.title).toBe("New Chat");
    });

    it("should get a chat by id", async () => {
      const created = await repo.createChat({ title: "Test Chat" }, testUserId);
      const retrieved = await repo.getChat(created.id, testUserId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe("Test Chat");
    });

    it("should return null for non-existent chat", async () => {
      const chat = await repo.getChat("non-existent-id", testUserId);

      expect(chat).toBeNull();
    });

    it("should not return chat for wrong user", async () => {
      const created = await repo.createChat({ title: "Test Chat" }, testUserId);
      const retrieved = await repo.getChat(created.id, "other-user");

      expect(retrieved).toBeNull();
    });

    it("should list chats", async () => {
      await repo.createChat({ title: "Chat 1" }, testUserId);
      await repo.createChat({ title: "Chat 2" }, testUserId);
      await repo.createChat({ title: "Chat 3" }, testUserId);

      const result = await repo.listChats(testUserId);

      expect(result.chats).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("should isolate chats by user", async () => {
      await repo.createChat({ title: "User A Chat" }, "user-a");
      await repo.createChat({ title: "User B Chat" }, "user-b");

      const resultA = await repo.listChats("user-a");
      const resultB = await repo.listChats("user-b");

      expect(resultA.chats).toHaveLength(1);
      expect(resultA.chats[0].title).toBe("User A Chat");
      expect(resultB.chats).toHaveLength(1);
      expect(resultB.chats[0].title).toBe("User B Chat");
    });

    it("should list chats with pagination", async () => {
      await repo.createChat({ title: "Chat 1" }, testUserId);
      await repo.createChat({ title: "Chat 2" }, testUserId);
      await repo.createChat({ title: "Chat 3" }, testUserId);

      const result = await repo.listChats(testUserId, { limit: 2, offset: 1 });

      expect(result.chats).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it("should update a chat", async () => {
      const chat = await repo.createChat({ title: "Original Title" }, testUserId);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = await repo.updateChat(chat.id, testUserId, { title: "Updated Title" });

      expect(updated).toBeDefined();
      expect(updated?.title).toBe("Updated Title");
      expect(updated?.updatedAt).not.toBe(chat.updatedAt);
    });

    it("should return null when updating non-existent chat", async () => {
      const result = await repo.updateChat("non-existent-id", testUserId, { title: "Test" });

      expect(result).toBeNull();
    });

    it("should delete a chat and return true", async () => {
      const chat = await repo.createChat({ title: "Test Chat" }, testUserId);
      const deleted = await repo.deleteChat(chat.id, testUserId);

      expect(deleted).toBe(true);

      const retrieved = await repo.getChat(chat.id, testUserId);
      expect(retrieved).toBeNull();
    });

    it("should return false when deleting non-existent chat", async () => {
      const deleted = await repo.deleteChat("non-existent-id", testUserId);

      expect(deleted).toBe(false);
    });

    it("should set chat session", async () => {
      const chat = await repo.createChat({ title: "Test Chat" }, testUserId);
      await repo.setChatSession(chat.id, "session-123");

      const retrieved = await repo.getChat(chat.id, testUserId);
      expect(retrieved?.sessionId).toBe("session-123");
    });
  });

  describe("Message operations", () => {
    let chatId: string;

    beforeEach(async () => {
      const chat = await repo.createChat({ title: "Test Chat" }, testUserId);
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

      await repo.deleteChat(chatId, testUserId);

      const result = await repo.getMessages(chatId);
      expect(result.messages).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("User operations", () => {
    it("should create a user", async () => {
      const user = await repo.createUser("testuser", "hashed-password");

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe("testuser");
      expect(user.createdAt).toBeDefined();
    });

    it("should get a user by username", async () => {
      await repo.createUser("testuser", "hashed-password");
      const found = await repo.getUserByUsername("testuser");

      expect(found).toBeDefined();
      expect(found?.username).toBe("testuser");
      expect(found?.passwordHash).toBe("hashed-password");
    });

    it("should return null for non-existent username", async () => {
      const found = await repo.getUserByUsername("nonexistent");
      expect(found).toBeNull();
    });

    it("should get a user by id", async () => {
      const created = await repo.createUser("testuser", "hashed-password");
      const found = await repo.getUserById(created.id);

      expect(found).toBeDefined();
      expect(found?.username).toBe("testuser");
    });
  });

  describe("API key operations", () => {
    let userId: string;

    beforeEach(async () => {
      const user = await repo.createUser("testuser", "hashed-password");
      userId = user.id;
    });

    it("should create an API key", async () => {
      const key = await repo.createApiKey(userId, "hash123", "cck_abc", "My Key");

      expect(key).toBeDefined();
      expect(key.id).toBeDefined();
      expect(key.userId).toBe(userId);
      expect(key.name).toBe("My Key");
      expect(key.keyPrefix).toBe("cck_abc");
      expect(key.revokedAt).toBeNull();
    });

    it("should find API key by hash", async () => {
      await repo.createApiKey(userId, "hash123", "cck_abc", "My Key");
      const found = await repo.getApiKeyByHash("hash123");

      expect(found).toBeDefined();
      expect(found?.userId).toBe(userId);
    });

    it("should not find revoked API key by hash", async () => {
      const key = await repo.createApiKey(userId, "hash123", "cck_abc", "My Key");
      await repo.revokeApiKey(key.id, userId);
      const found = await repo.getApiKeyByHash("hash123");

      expect(found).toBeNull();
    });

    it("should list API keys for a user", async () => {
      await repo.createApiKey(userId, "hash1", "cck_a", "Key 1");
      await repo.createApiKey(userId, "hash2", "cck_b", "Key 2");

      const keys = await repo.listApiKeys(userId);
      expect(keys).toHaveLength(2);
    });

    it("should revoke an API key", async () => {
      const key = await repo.createApiKey(userId, "hash123", "cck_abc", "My Key");
      const result = await repo.revokeApiKey(key.id, userId);

      expect(result).toBe(true);

      const keys = await repo.listApiKeys(userId);
      expect(keys[0].revokedAt).not.toBeNull();
    });

    it("should update API key last used", async () => {
      const key = await repo.createApiKey(userId, "hash123", "cck_abc", "My Key");
      await repo.updateApiKeyLastUsed(key.id);

      const keys = await repo.listApiKeys(userId);
      expect(keys[0].lastUsedAt).not.toBeNull();
    });
  });
});
