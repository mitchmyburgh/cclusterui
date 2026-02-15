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
} from "@claude-chat/shared";
import { DEFAULT_CHAT_TITLE, DEFAULT_PAGE_SIZE } from "@claude-chat/shared";

interface ChatDoc {
  _id: string;
  title: string;
  sessionId: string | null;
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

export class MongoRepository implements ChatRepository {
  private client: MongoClient;
  private db!: Db;
  private chats!: Collection<ChatDoc>;
  private messages!: Collection<MessageDoc>;

  constructor(config: { connectionString: string; dbName?: string }) {
    this.client = new MongoClient(config.connectionString);
  }

  async init(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db();
    this.chats = this.db.collection<ChatDoc>("chats");
    this.messages = this.db.collection<MessageDoc>("messages");

    // Create indexes
    await this.messages.createIndex({ chatId: 1 });
    await this.chats.createIndex({ updatedAt: -1 });
  }

  private chatDocToChat(doc: ChatDoc): Chat {
    return {
      id: doc._id,
      title: doc.title,
      sessionId: doc.sessionId,
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

  async createChat(input: CreateChatInput): Promise<Chat> {
    const now = new Date().toISOString();
    const doc: ChatDoc = {
      _id: randomUUID(),
      title: input.title || DEFAULT_CHAT_TITLE,
      sessionId: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.chats.insertOne(doc);

    return this.chatDocToChat(doc);
  }

  async getChat(id: string): Promise<Chat | null> {
    const doc = await this.chats.findOne({ _id: id });
    if (!doc) {
      return null;
    }
    return this.chatDocToChat(doc);
  }

  async listChats(params?: PaginationParams): Promise<{ chats: Chat[]; total: number }> {
    const limit = params?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = params?.offset ?? 0;

    const docs = await this.chats
      .find()
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await this.chats.countDocuments();

    return {
      chats: docs.map((doc) => this.chatDocToChat(doc)),
      total,
    };
  }

  async updateChat(id: string, input: UpdateChatInput): Promise<Chat | null> {
    const updatedAt = new Date().toISOString();

    const result = await this.chats.findOneAndUpdate(
      { _id: id },
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

  async deleteChat(id: string): Promise<boolean> {
    const chat = await this.getChat(id);
    if (!chat) {
      return false;
    }

    // Delete messages first
    await this.messages.deleteMany({ chatId: id });

    // Delete chat
    await this.chats.deleteOne({ _id: id });

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
}
