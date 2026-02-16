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
} from "@ccluster/shared";

export interface ChatRepository {
  // Chat operations (userId scoped)
  createChat(input: CreateChatInput, userId: string): Promise<Chat>;
  getChat(id: string, userId: string): Promise<Chat | null>;
  listChats(userId: string, params?: PaginationParams): Promise<{ chats: Chat[]; total: number }>;
  updateChat(id: string, userId: string, input: UpdateChatInput): Promise<Chat | null>;
  deleteChat(id: string, userId: string): Promise<boolean>;
  setChatSession(chatId: string, sessionId: string): Promise<void>;

  // Message operations
  addMessage(
    chatId: string,
    role: "user" | "assistant",
    content: MessageContent[],
    metadata?: MessageMetadata
  ): Promise<Message>;
  getMessages(
    chatId: string,
    params?: PaginationParams
  ): Promise<{ messages: Message[]; total: number }>;
  getMessage(id: string): Promise<Message | null>;

  // User operations
  createUser(username: string, passwordHash: string): Promise<User>;
  getUserByUsername(username: string): Promise<(User & { passwordHash: string }) | null>;
  getUserById(id: string): Promise<User | null>;

  // API key operations
  createApiKey(userId: string, keyHash: string, keyPrefix: string, name: string): Promise<ApiKey>;
  getApiKeyByHash(keyHash: string): Promise<(ApiKey & { userId: string }) | null>;
  listApiKeys(userId: string): Promise<ApiKey[]>;
  revokeApiKey(id: string, userId: string): Promise<boolean>;
  updateApiKeyLastUsed(id: string): Promise<void>;
}
