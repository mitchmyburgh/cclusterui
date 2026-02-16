import { createApp } from "../app.js";
import type { AppContext } from "../context.js";
import type { ChatRepository } from "@ccluster/db";
import type { ClientManager } from "@ccluster/client";

describe("Auth middleware", () => {
  let app: ReturnType<typeof createApp>;
  const mockRepo: ChatRepository = {
    createChat: vi.fn(),
    getChat: vi.fn(),
    listChats: vi.fn(),
    updateChat: vi.fn(),
    deleteChat: vi.fn(),
    setChatSession: vi.fn(),
    addMessage: vi.fn(),
    getMessages: vi.fn(),
    getMessage: vi.fn(),
    createUser: vi.fn(),
    getUserByUsername: vi.fn(),
    getUserById: vi.fn(),
    createApiKey: vi.fn(),
    getApiKeyByHash: vi.fn(),
    listApiKeys: vi.fn(),
    revokeApiKey: vi.fn(),
    updateApiKeyLastUsed: vi.fn(),
  } as any;

  const mockClientManager: ClientManager = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();

    const context: AppContext = {
      repo: mockRepo,
      clientManager: mockClientManager,
      config: {
        port: 3000,
        host: "0.0.0.0",
        apiKeys: ["test-api-key-123", "another-valid-key"],
        anthropicApiKey: "test-anthropic-key",
        jwtSecret: "",
        allowedUsernames: [],
        db: {
          driver: "sqlite",
          sqlitePath: ":memory:",
        },
      },
    };

    app = createApp(context);
  });

  it("should allow access to /health without auth", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  it("should return 401 for /api/chats without auth header", async () => {
    const res = await app.request("/api/chats");

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toMatchObject({
      error: "Unauthorized",
      code: "MISSING_TOKEN",
      status: 401,
    });
  });

  it("should return 401 for /api/chats with invalid Bearer token", async () => {
    const res = await app.request("/api/chats", {
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toMatchObject({
      error: "Unauthorized",
      code: "INVALID_TOKEN",
      status: 401,
    });
  });

  it("should pass auth with valid legacy Bearer token", async () => {
    (mockRepo.listChats as any).mockResolvedValue({
      chats: [],
      total: 0,
    });

    const res = await app.request("/api/chats", {
      headers: {
        Authorization: "Bearer test-api-key-123",
      },
    });

    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: [], total: 0 });
  });

  it("should pass auth with another valid legacy Bearer token", async () => {
    (mockRepo.listChats as any).mockResolvedValue({
      chats: [],
      total: 0,
    });

    const res = await app.request("/api/chats", {
      headers: {
        Authorization: "Bearer another-valid-key",
      },
    });

    expect(res.status).toBe(200);
  });

  it("should return 401 for POST /api/chats without auth", async () => {
    const res = await app.request("/api/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Test Chat" }),
    });

    expect(res.status).toBe(401);
  });

  it("should allow POST /api/chats with valid auth", async () => {
    (mockRepo.createChat as any).mockResolvedValue({
      id: "chat-1",
      title: "Test Chat",
      sessionId: null,
      userId: "system",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await app.request("/api/chats", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-api-key-123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Test Chat" }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.title).toBe("Test Chat");
  });

  it("should allow access to /api/auth/login without auth", async () => {
    (mockRepo.getUserByUsername as any).mockResolvedValue(null);

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "test", password: "pass" }),
    });

    // Should not be 401 (auth routes are public)
    // Will be 500 because JWT_SECRET is empty, but NOT 401
    expect(res.status).toBe(500);
  });
});
