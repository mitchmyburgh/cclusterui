export type MessageRole = "user" | "assistant";

export interface MessageContent {
  type: "text" | "image";
  text?: string;
  imageData?: string;
  mimeType?: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: MessageContent[];
  createdAt: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  totalCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  model?: string;
}

export interface SendMessageInput {
  content: MessageContent[];
}
