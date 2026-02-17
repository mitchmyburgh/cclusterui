import { useState, type FormEvent } from "react";
import { useTheme } from "../../context/ThemeContext";

interface LoginFormProps {
  onLogin: (token: string, user: { id: string; username: string }) => void;
  onApiKey: (key: string) => void;
}

type Tab = "login" | "register" | "apikey";

export function LoginForm({ onLogin, onApiKey }: LoginFormProps) {
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKeyValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error || `HTTP ${res.status}`);
        return;
      }

      onLogin(body.data.token, body.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleApiKeySubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("Please enter an API key");
      return;
    }
    onApiKey(trimmed);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "login", label: "Login" },
    { key: "register", label: "Register" },
    { key: "apikey", label: "API Key" },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-8 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CCluster</h1>
          <button
            onClick={toggleTheme}
            className="rounded-md px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Sign in to start chatting.</p>

        {/* Tabs */}
        <div className="mb-6 flex rounded-md bg-gray-100 dark:bg-gray-700 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setError("");
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-[#cb3837] text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "apikey" ? (
          <form onSubmit={handleApiKeySubmit}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKeyValue(e.target.value);
                setError("");
              }}
              placeholder="Enter API key..."
              className="mb-3 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-[#cb3837] focus:ring-1 focus:ring-[#cb3837]"
              autoFocus
            />
            {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-md bg-[#cb3837] px-4 py-3 font-medium text-white hover:bg-[#b53130] transition-colors"
            >
              Connect
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuthSubmit}>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              placeholder="Username"
              className="mb-3 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-[#cb3837] focus:ring-1 focus:ring-[#cb3837]"
              autoFocus
              autoComplete="username"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="Password"
              className="mb-3 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-[#cb3837] focus:ring-1 focus:ring-[#cb3837]"
              autoComplete={
                tab === "register" ? "new-password" : "current-password"
              }
            />
            {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#cb3837] px-4 py-3 font-medium text-white hover:bg-[#b53130] transition-colors disabled:opacity-50"
            >
              {loading ? "..." : tab === "login" ? "Login" : "Register"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
