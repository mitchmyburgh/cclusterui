export interface Chat {
  id: string;
  title: string;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChatInput {
  title?: string;
}

export interface UpdateChatInput {
  title?: string;
}
