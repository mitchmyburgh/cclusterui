import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  getStoredToken,
  setStoredToken,
  getStoredUser,
  setStoredUser,
  clearAuth,
  type StoredUser,
} from "../lib/storage";

interface AuthContextValue {
  token: string | null;
  user: StoredUser | null;
  isAuthenticated: boolean;
  // Legacy compat
  apiKey: string | null;
  setApiKey: (key: string) => void;
  // New auth methods
  login: (token: string, user: StoredUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getStoredToken);
  const [user, setUserState] = useState<StoredUser | null>(getStoredUser);
  const isAuthenticated = token !== null && token.length > 0;

  const login = useCallback((newToken: string, newUser: StoredUser) => {
    setStoredToken(newToken);
    setStoredUser(newUser);
    setTokenState(newToken);
    setUserState(newUser);
  }, []);

  const setApiKey = useCallback((key: string) => {
    setStoredToken(key);
    setTokenState(key);
    setUserState({ id: "system", username: "system" });
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setTokenState(null);
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        apiKey: token,
        setApiKey,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
