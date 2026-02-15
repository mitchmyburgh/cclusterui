import { clearStoredApiKey } from "./storage";

export function createApiClient(apiKey: string) {
  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...options?.headers,
      },
    });

    if (res.status === 401) {
      clearStoredApiKey();
      window.location.reload();
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      }),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (path: string) =>
      request<void>(path, { method: "DELETE" }),
  };
}
