import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { Chat, Message, WSServerToViewerEvent } from "@claude-chat/shared";
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
  const [producerConnected, setProducerConnected] = useState(false);
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
    const client = connectWs(serverUrl, apiKey, chat.id, "viewer");

    client.onOpen(() => setConnected(true));
    client.onClose(() => setConnected(false));

    client.onEvent((event: WSServerToViewerEvent) => {
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
        case "user_message_stored":
          // Replace optimistic message with server-persisted version
          setMessages((prev) => {
            let idx = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].role === "user" && prev[i].id.startsWith("temp-")) {
                idx = i;
                break;
              }
            }
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = event.message;
              return updated;
            }
            // Message from another viewer — append it
            return [...prev, event.message];
          });
          break;
        case "tool_use":
          setStatus(`tool: ${event.toolName}`);
          break;
        case "status":
          setStatus(event.status === "idle" ? null : event.status);
          break;
        case "producer_status":
          setProducerConnected(event.connected);
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
        <Box gap={1}>
          <Text color={producerConnected ? "green" : "red"}>
            {producerConnected ? "● client" : "○ no client"}
          </Text>
          <Text dimColor>{connected ? "● ws" : "○ ws"}</Text>
        </Box>
      </Box>

      {!producerConnected && (
        <Box marginBottom={1}>
          <Text color="yellow">No local client connected. Run `claude-chat-client --chat {chat.id}` to start.</Text>
        </Box>
      )}

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

      <Input onSubmit={handleSend} disabled={isStreaming || !connected || !producerConnected} />

      <Box marginTop={1}>
        <Text dimColor>Esc {isStreaming ? "cancel" : "back"}</Text>
      </Box>
    </Box>
  );
}
