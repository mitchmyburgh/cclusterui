import { MongoClient, Collection, Db } from "mongodb";
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

interface ChatDoc {
  _id: string;
  title: string;
  sessionId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface MessageDoc {
  _id: string;
  chatId: string;
  role: "user" | "assistant";
  content: MessageContent[];
  createdAt: string;
  metadata?: MessageMetadata;
}

interface UserDoc {
  _id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiKeyDoc {
  _id: string;
  userId: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export class MongoRepository implements ChatRepository {
  private client: MongoClient;
  private db!: Db;
  private chats!: Collection<ChatDoc>;
  private messages!: Collection<MessageDoc>;
  private users!: Collection<UserDoc>;
  private apiKeys!: Collection<ApiKeyDoc>;

  constructor(config: { connectionString: string; dbName?: string }) {
    this.client = new MongoClient(config.connectionString);
  }

  async init(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db();
    this.chats = this.db.collection<ChatDoc>("chats");
    this.messages = this.db.collection<MessageDoc>("messages");
    this.users = this.db.collection<UserDoc>("users");
    this.apiKeys = this.db.collection<ApiKeyDoc>("apiKeys");

    // Create indexes
    await this.messages.createIndex({ chatId: 1 });
    await this.chats.createIndex({ updatedAt: -1 });
    await this.chats.createIndex({ userId: 1 });
    await this.users.createIndex({ username: 1 }, { unique: true });
    await this.apiKeys.createIndex({ keyHash: 1 }, { unique: true });
    await this.apiKeys.createIndex({ userId: 1 });
  }

  private chatDocToChat(doc: ChatDoc): Chat {
    return {
      id: doc._id,
      title: doc.title,
      sessionId: doc.sessionId,
      userId: doc.userId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private messageDocToMessage(doc: MessageDoc): Message {
    return {
      id: doc._id,
      chatId: doc.chatId,
      role: doc.role,
      content: doc.content,
      createdAt: doc.createdAt,
      metadata: doc.metadata,
    };
  }

  private userDocToUser(doc: UserDoc): User {
    return {
      id: doc._id,
      username: doc.username,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private apiKeyDocToApiKey(doc: ApiKeyDoc): ApiKey {
    return {
      id: doc._id,
      userId: doc.userId,
      name: doc.name,
      keyPrefix: doc.keyPrefix,
      createdAt: doc.createdAt,
      lastUsedAt: doc.lastUsedAt,
      revokedAt: doc.revokedAt,
    };
  }

  // Chat operations

  async createChat(input: CreateChatInput, userId: string): Promise<Chat> {
    const now = new Date().toISOString();
    const doc: ChatDoc = {
      _id: randomUUID(),
      title: input.title || DEFAULT_CHAT_TITLE,
      sessionId: null,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    await this.chats.insertOne(doc);

    return this.chatDocToChat(doc);
  }

  async getChat(id: string, userId: string): Promise<Chat | null> {
    const doc = await this.chats.findOne({ _id: id, userId });
    if (!doc) {
      return null;
    }
    return this.chatDocToChat(doc);
  }

  async listChats(userId: string, params?: PaginationParams): Promise<{ chats: Chat[]; total: number }> {
    const limit = params?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = params?.offset ?? 0;

    const docs = await this.chats
      .find({ userId })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await this.chats.countDocuments({ userId });

    return {
      chats: docs.map((doc) => this.chatDocToChat(doc)),
      total,
    };
  }

  async updateChat(id: string, userId: string, input: UpdateChatInput): Promise<Chat | null> {
    const updatedAt = new Date().toISOString();

    const result = await this.chats.findOneAndUpdate(
      { _id: id, userId },
      {
        $set: {
          ...(input.title !== undefined && { title: input.title }),
          updatedAt,
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return null;
    }

    return this.chatDocToChat(result);
  }

  async deleteChat(id: string, userId: string): Promise<boolean> {
    const chat = await this.getChat(id, userId);
    if (!chat) {
      return false;
    }

    // Delete messages first
    await this.messages.deleteMany({ chatId: id });

    // Delete chat
    await this.chats.deleteOne({ _id: id, userId });

    return true;
  }

  async setChatSession(chatId: string, sessionId: string): Promise<void> {
    const updatedAt = new Date().toISOString();

    await this.chats.updateOne(
      { _id: chatId },
      {
        $set: {
          sessionId,
          updatedAt,
        },
      }
    );
  }

  // Message operations

  async addMessage(
    chatId: string,
    role: "user" | "assistant",
    content: MessageContent[],
    metadata?: MessageMetadata
  ): Promise<Message> {
    const now = new Date().toISOString();
    const doc: MessageDoc = {
      _id: randomUUID(),
      chatId,
      role,
      content,
      createdAt: now,
      metadata,
    };

    await this.messages.insertOne(doc);

    // Update chat's updatedAt
    await this.chats.updateOne({ _id: chatId }, { $set: { updatedAt: now } });

    return this.messageDocToMessage(doc);
  }

  async getMessages(
    chatId: string,
    params?: PaginationParams
  ): Promise<{ messages: Message[]; total: number }> {
    const limit = params?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = params?.offset ?? 0;

    const docs = await this.messages
      .find({ chatId })
      .sort({ createdAt: 1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await this.messages.countDocuments({ chatId });

    return {
      messages: docs.map((doc) => this.messageDocToMessage(doc)),
      total,
    };
  }

  async getMessage(id: string): Promise<Message | null> {
    const doc = await this.messages.findOne({ _id: id });
    if (!doc) {
      return null;
    }
    return this.messageDocToMessage(doc);
  }

  // User operations

  async createUser(username: string, passwordHash: string): Promise<User> {
    const now = new Date().toISOString();
    const doc: UserDoc = {
      _id: randomUUID(),
      username,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    await this.users.insertOne(doc);

    return this.userDocToUser(doc);
  }

  async getUserByUsername(username: string): Promise<(User & { passwordHash: string }) | null> {
    const doc = await this.users.findOne({ username });
    if (!doc) {
      return null;
    }

    return {
      id: doc._id,
      username: doc.username,
      passwordHash: doc.passwordHash,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await this.users.findOne({ _id: id });
    if (!doc) {
      return null;
    }

    return this.userDocToUser(doc);
  }

  // API key operations

  async createApiKey(userId: string, keyHash: string, keyPrefix: string, name: string): Promise<ApiKey> {
    const now = new Date().toISOString();
    const doc: ApiKeyDoc = {
      _id: randomUUID(),
      userId,
      keyHash,
      keyPrefix,
      name,
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    };

    await this.apiKeys.insertOne(doc);

    return this.apiKeyDocToApiKey(doc);
  }

  async getApiKeyByHash(keyHash: string): Promise<(ApiKey & { userId: string }) | null> {
    const doc = await this.apiKeys.findOne({ keyHash, revokedAt: null });
    if (!doc) {
      return null;
    }

    return {
      id: doc._id,
      userId: doc.userId,
      name: doc.name,
      keyPrefix: doc.keyPrefix,
      createdAt: doc.createdAt,
      lastUsedAt: doc.lastUsedAt,
      revokedAt: doc.revokedAt,
    };
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    const docs = await this.apiKeys
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    return docs.map((doc) => this.apiKeyDocToApiKey(doc));
  }

  async revokeApiKey(id: string, userId: string): Promise<boolean> {
    const result = await this.apiKeys.findOneAndUpdate(
      { _id: id, userId },
      { $set: { revokedAt: new Date().toISOString() } },
      { returnDocument: "after" }
    );

    return result !== null;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await this.apiKeys.updateOne(
      { _id: id },
      { $set: { lastUsedAt: new Date().toISOString() } }
    );
  }
}
