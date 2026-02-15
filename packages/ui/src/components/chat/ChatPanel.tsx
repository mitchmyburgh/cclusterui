import { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { createApiClient } from "../../lib/api";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import type { Chat, Message, MessageContent, WSServerToViewerEvent } from "@claude-chat/shared";

interface ChatPanelProps {
  chatId: string;
  chat?: Chat;
  apiKey: string;
  onClose: () => void;
}

export function ChatPanel({ chatId, chat, apiKey, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [loading, setLoading] = useState(true);
  const [producerConnected, setProducerConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch message history
  useEffect(() => {
    const api = createApiClient(apiKey);
    api.get<{ data: Message[]; total: number }>(`/api/chats/${chatId}/messages`)
      .then((res) => { setMessages(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [chatId, apiKey]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleWSEvent = useCallback((event: WSServerToViewerEvent) => {
    switch (event.type) {
      case "message_start":
        setStreamingId(event.messageId);
        setStreamingText("");
        setStatus("responding");
        break;
      case "message_delta":
        setStreamingText((prev) => prev + event.delta);
        break;
      case "message_complete":
        setMessages((prev) => [...prev, event.message]);
        setStreamingText("");
        setStreamingId(null);
        setStatus("idle");
        break;
      case "user_message_stored":
        // Replace optimistic user message with server-persisted version
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
          return prev;
        });
        break;
      case "tool_use":
        setStatus(`Using: ${event.toolName}`);
        break;
      case "status":
        setStatus(event.status);
        break;
      case "producer_status":
        setProducerConnected(event.connected);
        break;
      case "error":
        setStatus("idle");
        setStreamingText("");
        setStreamingId(null);
        break;
    }
  }, []);

  const { connected, send } = useWebSocket(chatId, apiKey, handleWSEvent);

  const handleSend = useCallback((content: MessageContent[]) => {
    // Optimistically add user message
    const userMsg: Message = {
      id: `temp-${crypto.randomUUID()}`,
      chatId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    send({ type: "send_message", content });
  }, [chatId, send]);

  const handleCancel = useCallback(() => {
    send({ type: "cancel" });
    setStreamingText("");
    setStreamingId(null);
    setStatus("idle");
  }, [send]);

  const isStreaming = streamingId !== null;

  return (
    <div className="flex flex-1 flex-col border-r border-gray-700 last:border-r-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium truncate">{chat?.title || "Chat"}</h2>
          <span
            className={`inline-block h-2 w-2 rounded-full ${producerConnected ? "bg-green-500" : "bg-red-500"}`}
            title={producerConnected ? "Client connected" : "No client connected"}
          />
          {!connected && (
            <span className="rounded bg-yellow-600 px-1.5 py-0.5 text-[10px]">Reconnecting...</span>
          )}
          {status !== "idle" && (
            <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300">{status}</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-500 border-t-blue-500" />
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <p className="py-8 text-center text-sm text-gray-500">Send a message to start the conversation</p>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && streamingText && (
              <div className="flex justify-start mb-3">
                <div className="max-w-[80%] rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-100 whitespace-pre-wrap break-words">
                  {streamingText}
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-400 animate-pulse" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        onCancel={isStreaming ? handleCancel : undefined}
        producerDisconnected={!producerConnected}
        chatId={chatId}
      />
    </div>
  );
}
