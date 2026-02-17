import { useState } from "react";
import type { Chat } from "@mitchmyburgh/shared";

interface ChatListProps {
  chats: Chat[];
  activeChatIds: string[];
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  loading: boolean;
}

export function ChatList({ chats, activeChatIds, onSelectChat, onDeleteChat, loading }: ChatListProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? chats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : chats;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#cb3837]" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-3 py-2">
        <input
          type="text"
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 outline-none focus:ring-1 focus:ring-[#cb3837] focus:border-[#cb3837]"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            {search ? "No results" : "No chats yet"}
          </p>
        ) : (
          filtered.map((chat) => {
            const isActive = activeChatIds.includes(chat.id);
            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`group flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-gray-100 ${
                  isActive ? "bg-red-50 border-l-2 border-[#cb3837]" : "border-l-2 border-transparent"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{chat.title}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(chat.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                  className="ml-2 hidden rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600 group-hover:block"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
