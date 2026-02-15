import { useState, useMemo, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { createApiClient } from "../../lib/api";
import { ChatList } from "../chat/ChatList";
import { ChatPanel } from "../chat/ChatPanel";
import { SettingsPanel } from "../settings/SettingsPanel";
import type { Chat } from "@claude-chat/shared";

export function AppLayout() {
  const { apiKey, user, logout } = useAuth();
  const api = useMemo(() => createApiClient(apiKey!), [apiKey]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch chats on mount
  useState(() => {
    api.get<{ data: Chat[]; total: number }>("/api/chats")
      .then((res) => { setChats(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  });

  const handleSelectChat = useCallback((id: string) => {
    setOpenPanels((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length >= 3) return [id, ...prev.slice(0, 2)];
      return [...prev, id];
    });
  }, []);

  const handleDeleteChat = useCallback(async (id: string) => {
    await api.delete(`/api/chats/${id}`);
    setChats((prev) => prev.filter((c) => c.id !== id));
    setOpenPanels((prev) => prev.filter((p) => p !== id));
  }, [api]);

  const handleClosePanel = useCallback((id: string) => {
    setOpenPanels((prev) => prev.filter((p) => p !== id));
  }, []);

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <aside className="flex w-80 flex-col border-r border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <h1 className="text-lg font-semibold">Claude Chat</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600 transition-colors"
              title="Settings"
            >
              Settings
            </button>
            <button
              onClick={logout}
              className="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
        {user && user.username !== "system" && (
          <div className="border-b border-gray-700 px-4 py-2">
            <span className="text-xs text-gray-400">Signed in as </span>
            <span className="text-xs text-white font-medium">{user.username}</span>
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
          <div className="flex flex-1 items-center justify-center text-gray-500">
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
