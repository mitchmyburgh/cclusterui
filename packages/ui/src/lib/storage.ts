const TOKEN_STORAGE_KEY = "ccluster-token";
const USER_STORAGE_KEY = "ccluster-user";
// Legacy key for backward compat
const API_KEY_STORAGE_KEY = "ccluster-api-key";

export interface StoredUser {
  id: string;
  username: string;
}

export function getStoredToken(): string | null {
  return (
    sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
    localStorage.getItem(API_KEY_STORAGE_KEY)
  );
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  // Clean up any legacy localStorage token
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = sessionStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser): void {
  sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export async function clearAuth(): Promise<void> {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(API_KEY_STORAGE_KEY);

  // Clear PWA api-cache on logout (H11)
  if ("caches" in window) {
    try {
      await caches.delete("api-cache");
    } catch {
      // ignore cache deletion errors
    }
  }
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
