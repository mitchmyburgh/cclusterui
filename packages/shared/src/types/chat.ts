export interface Chat {
  id: string;
  title: string;
  sessionId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChatInput {
  title?: string;
  userId?: string;
}

export interface UpdateChatInput {
  title?: string;
}
