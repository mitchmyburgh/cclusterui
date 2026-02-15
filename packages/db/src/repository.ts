import type {
  Chat,
  CreateChatInput,
  UpdateChatInput,
  Message,
  MessageContent,
  MessageMetadata,
  PaginationParams,
} from "@claude-chat/shared";

export interface ChatRepository {
  createChat(input: CreateChatInput): Promise<Chat>;
  getChat(id: string): Promise<Chat | null>;
  listChats(params?: PaginationParams): Promise<{ chats: Chat[]; total: number }>;
  updateChat(id: string, input: UpdateChatInput): Promise<Chat | null>;
  deleteChat(id: string): Promise<boolean>;
  setChatSession(chatId: string, sessionId: string): Promise<void>;
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
}
