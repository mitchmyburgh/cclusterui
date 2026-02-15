import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { Chat } from "@claude-chat/shared";
import type { ApiClient } from "../api.js";

interface Props {
  api: ApiClient;
  onSelectChat: (chat: Chat) => void;
  onQuit: () => void;
}

export function ChatListView({ api, onSelectChat, onQuit }: Props) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  const fetchChats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listChats();
      setChats(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  useInput(async (_input, key) => {
    if (loading) return;

    if (_input === "q") {
      onQuit();
      return;
    }

    if (_input === "d" && chats.length > 0) {
      try {
        await api.deleteChat(chats[cursor]!.id);
        const newChats = chats.filter((_, i) => i !== cursor);
        setChats(newChats);
        if (cursor >= newChats.length && cursor > 0) {
          setCursor(cursor - 1);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete chat");
      }
      return;
    }

    if (_input === "r") {
      fetchChats();
      return;
    }

    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor((c) => Math.min(chats.length - 1, c + 1));
    } else if (key.return && chats.length > 0) {
      onSelectChat(chats[cursor]!);
    }
  });

  if (loading) {
    return (
      <Box>
        <Text>
          <Spinner type="dots" /> Loading chats...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">
          Claude Chat
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {chats.length === 0 ? (
        <Text dimColor>No chats yet. Start a local client to create one.</Text>
      ) : (
        chats.map((chat, i) => (
          <Box key={chat.id}>
            <Text
              color={i === cursor ? "blue" : undefined}
              bold={i === cursor}
            >
              {i === cursor ? "❯ " : "  "}
              {chat.title}
            </Text>
            <Text dimColor>
              {"  "}
              {new Date(chat.updatedAt).toLocaleDateString()}
            </Text>
          </Box>
        ))
      )}

      <Box marginTop={1}>
        <Text dimColor>
          ↑↓ navigate · Enter select · d delete · r refresh · q quit
        </Text>
      </Box>
    </Box>
  );
}
