const TOKEN_STORAGE_KEY = "claude-chat-token";
const USER_STORAGE_KEY = "claude-chat-user";
// Legacy key for backward compat
const API_KEY_STORAGE_KEY = "claude-chat-api-key";

export interface StoredUser {
  id: string;
  username: string;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

// Legacy compat
export function getStoredApiKey(): string | null {
  return getStoredToken();
}

export function setStoredApiKey(key: string): void {
  setStoredToken(key);
}

export function clearStoredApiKey(): void {
  clearAuth();
}
