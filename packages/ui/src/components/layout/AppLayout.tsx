import { useState, useMemo, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { createApiClient } from "../../lib/api";
import { ChatList } from "../chat/ChatList";
import { ChatPanel } from "../chat/ChatPanel";
import { SettingsPanel } from "../settings/SettingsPanel";
import type { Chat } from "@mitchmyburgh/shared";

export function AppLayout() {
  const { apiKey, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const api = useMemo(() => createApiClient(apiKey!), [apiKey]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch chats on mount
  useState(() => {
    api
      .get<{ data: Chat[]; total: number }>("/api/chats")
      .then((res) => {
        setChats(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  });

  const handleSelectChat = useCallback((id: string) => {
    setOpenPanels((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length >= 3) return [id, ...prev.slice(0, 2)];
      return [...prev, id];
    });
  }, []);

  const handleDeleteChat = useCallback(
    async (id: string) => {
      await api.delete(`/api/chats/${id}`);
      setChats((prev) => prev.filter((c) => c.id !== id));
      setOpenPanels((prev) => prev.filter((p) => p !== id));
    },
    [api],
  );

  const handleClosePanel = useCallback((id: string) => {
    setOpenPanels((prev) => prev.filter((p) => p !== id));
  }, []);

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <aside className="flex w-80 flex-col border-r border-gray-200 dark:border-gray-700 bg-[#fafafa] dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <h1 className="text-lg font-bold text-[#cb3837]">CCluster</h1>
          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-md bg-white dark:bg-gray-700 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-md bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="Settings"
            >
              Settings
            </button>
            <button
              onClick={logout}
              className="rounded-md bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
        {user && user.username !== "system" && (
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Signed in as </span>
            <span className="text-xs text-gray-900 dark:text-gray-100 font-medium">
              {user.username}
            </span>
          </div>
        )}
        <ChatList
          chats={chats}
          activeChatIds={openPanels}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          loading={loading}
        />
      </aside>

      {/* Panels */}
      <main className="flex flex-1">
        {showSettings ? (
          <div className="flex-1">
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        ) : openPanels.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500">
            <p>Start a local client to create a chat</p>
          </div>
        ) : (
          openPanels.map((chatId) => (
            <ChatPanel
              key={chatId}
              chatId={chatId}
              chat={chats.find((c) => c.id === chatId)}
              apiKey={apiKey!}
              onClose={() => handleClosePanel(chatId)}
            />
          ))
        )}
      </main>
    </div>
  );
}
