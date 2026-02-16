import type {
  Chat,
  CreateChatInput,
  ApiResponse,
  ApiListResponse,
} from "@ccluster/shared";

export function createApiClient(serverUrl: string, apiKey: string) {
  async function request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const res = await fetch(`${serverUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...options?.headers,
      },
    });

    if (res.status === 401) {
      throw new Error("Unauthorized — check your API key");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error || `HTTP ${res.status}`
      );
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return {
    listChats: () =>
      request<ApiListResponse<Chat>>("/api/chats"),
    createChat: (input?: CreateChatInput) =>
      request<ApiResponse<Chat>>("/api/chats", {
        method: "POST",
        body: JSON.stringify(input ?? {}),
      }),
    deleteChat: (id: string) =>
      request<void>(`/api/chats/${id}`, { method: "DELETE" }),
    getChat: (id: string) =>
      request<ApiResponse<Chat>>(`/api/chats/${id}`),
    getMessages: (chatId: string) =>
      request<ApiListResponse<import("@ccluster/shared").Message>>(
        `/api/chats/${chatId}/messages`
      ),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
