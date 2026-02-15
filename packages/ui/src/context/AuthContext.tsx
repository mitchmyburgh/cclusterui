import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey } from "../lib/storage";

interface AuthContextValue {
  apiKey: string | null;
  isAuthenticated: boolean;
  setApiKey: (key: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
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

  return (
    <AuthContext.Provider value={{ apiKey, isAuthenticated, setApiKey, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
