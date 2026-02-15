import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { Chat, Message, WSServerEvent } from "@claude-chat/shared";
import type { ApiClient } from "../api.js";
import { connectWs } from "../ws.js";
import { MessageList } from "../components/MessageList.js";
import { Input } from "../components/Input.js";

interface Props {
  api: ApiClient;
  serverUrl: string;
  apiKey: string;
  chat: Chat;
  onBack: () => void;
}

export function ChatView({ api, serverUrl, apiKey, chat, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [ws, setWs] = useState<ReturnType<typeof connectWs> | null>(null);

  useEffect(() => {
    api
      .getMessages(chat.id)
      .then((res) => {
        setMessages(res.data);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load messages");
      })
      .finally(() => setLoading(false));
  }, [chat.id]);

  useEffect(() => {
    const client = connectWs(serverUrl, apiKey, chat.id);

    client.onOpen(() => setConnected(true));
    client.onClose(() => setConnected(false));

    client.onEvent((event: WSServerEvent) => {
      switch (event.type) {
        case "message_start":
          setIsStreaming(true);
          setStreamingText("");
          break;
        case "message_delta":
          setStreamingText((prev) => prev + event.delta);
          break;
        case "message_complete":
          setMessages((prev) => [...prev, event.message]);
          setStreamingText("");
          setIsStreaming(false);
          setStatus(null);
          break;
        case "tool_use":
          setStatus(`tool: ${event.toolName}`);
          break;
        case "status":
          setStatus(event.status === "idle" ? null : event.status);
          break;
        case "error":
          setError(event.error);
          setIsStreaming(false);
          setStreamingText("");
          setStatus(null);
          break;
      }
    });

    setWs(client);
    return () => client.close();
  }, [chat.id, serverUrl, apiKey]);

  useInput((_input, key) => {
    if (key.escape) {
      if (isStreaming && ws) {
        ws.send({ type: "cancel" });
      } else {
        onBack();
      }
    }
  });

  const handleSend = useCallback(
    (text: string) => {
      if (!ws || !connected) return;

      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        chatId: chat.id,
        role: "user",
        content: [{ type: "text", text }],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      ws.send({
        type: "send_message",
        content: [{ type: "text", text }],
      });
    },
    [ws, connected, chat.id]
  );

  if (loading) {
    return (
      <Box>
        <Text>
          <Spinner type="dots" /> Loading messages...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="blue">
          {chat.title}
        </Text>
        <Text dimColor>{connected ? "● connected" : "○ disconnected"}</Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      <MessageList
        messages={messages}
        streamingText={streamingText}
        status={status}
      />

      <Input onSubmit={handleSend} disabled={isStreaming || !connected} />

      <Box marginTop={1}>
        <Text dimColor>Esc {isStreaming ? "cancel" : "back"}</Text>
      </Box>
    </Box>
  );
}
