# 10 - Frontend Authentication

## Goal

Implement API key entry, localStorage persistence, and auth context so all API calls include the key.

## Steps

### 10.1 Create storage helper

Create `packages/ui/src/lib/storage.ts`:

```typescript
const API_KEY_STORAGE_KEY = "claude-chat-api-key";

export function getStoredApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}
```

### 10.2 Create auth hook

Create `packages/ui/src/hooks/useAuth.ts`:

```typescript
import { useState, useCallback } from "react";
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey } from "../lib/storage";

export function useAuth() {
  const [apiKey, setApiKeyState] = useState<string | null>(getStoredApiKey);
  const isAuthenticated = apiKey !== null && apiKey.length > 0;

  const setApiKey = useCallback((key: string) => {
    setStoredApiKey(key);
    setApiKeyState(key);
  }, []);

  const logout = useCallback(() => {
    clearStoredApiKey();
    setApiKeyState(null);
  }, []);

  return { apiKey, isAuthenticated, setApiKey, logout };
}
```

### 10.3 Create auth context

Create `packages/ui/src/context/AuthContext.tsx`:

- React context providing `{ apiKey, isAuthenticated, setApiKey, logout }`
- Provider wraps the app in `App.tsx`
- `useAuthContext()` hook to consume from any component

### 10.4 Create API key modal

Create `packages/ui/src/components/auth/ApiKeyModal.tsx`:

- Full-screen overlay (modal) shown when `!isAuthenticated`
- Input field for API key (type="password" for masking)
- "Connect" button that calls `setApiKey(value)`
- Validates that key is non-empty before saving
- Shows error message if key validation fails (optional: test against /health with key)
- Clean, centered design with app branding

### 10.5 Create API client with auth

Create `packages/ui/src/lib/api.ts`:

```typescript
// Wraps fetch() with:
// - Base URL (empty, since we proxy via Vite)
// - Authorization header from stored API key
// - JSON content-type
// - Error handling (401 -> clear key, redirect to login)

export function createApiClient(apiKey: string) {
  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
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

    return res.json();
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) => request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
    patch: <T>(path: string, body: unknown) => request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    delete: (path: string) => request<void>(path, { method: "DELETE" }),
  };
}
```

### 10.6 Integrate into App.tsx

```typescript
function App() {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return <ApiKeyModal onSubmit={auth.setApiKey} />;
  }

  return <AppLayout apiKey={auth.apiKey!} onLogout={auth.logout} />;
}
```

### 10.7 Add logout button

Add a settings/logout button in the sidebar header:
- Shows current key (masked, e.g., `sk-...abc`)
- "Disconnect" button calls `logout()`

## Output

- API key modal shown on first visit / after logout
- Key persisted in localStorage
- All API calls include Authorization header
- 401 responses auto-clear key and show modal again
- Logout button available in sidebar
