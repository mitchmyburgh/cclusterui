import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type {
  Chat,
  Message,
  WSServerToViewerEvent,
  AgentMode,
  FileSearchResult,
  Skill,
} from "@mitchmyburgh/shared";
import type { ApiClient } from "../api.js";
import { connectWs } from "../ws.js";
import { MessageList } from "../components/MessageList.js";
import { Input } from "../components/Input.js";
import { FileSearchOverlay } from "../components/FileSearchOverlay.js";
import { SkillsOverlay } from "../components/SkillsOverlay.js";
import { fetchClipboard } from "../clipboard.js";

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
  const [mode, setMode] = useState<AgentMode>("accept_all");
  const [ws, setWs] = useState<ReturnType<typeof connectWs> | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [fileSearchResults, setFileSearchResults] = useState<
    FileSearchResult[]
  >([]);
  const [fileSearchLoading, setFileSearchLoading] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showSkills, setShowSkills] = useState(false);
  const [pendingImages, setPendingImages] = useState<
    Array<{ id: string; mimeType: string; dataUrl: string }>
  >([]);

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
          if (event.mode) setMode(event.mode);
          if (event.skills) setSkills(event.skills);
          break;
        case "file_search_results":
          setFileSearchResults(event.results);
          setFileSearchLoading(false);
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

  const MODES: AgentMode[] = ["plan", "human_confirm", "accept_all"];
  const MODE_LABELS: Record<AgentMode, string> = {
    plan: "plan",
    human_confirm: "confirm",
    accept_all: "auto",
  };

  useInput((input, key) => {
    if (key.escape) {
      if (isStreaming && ws) {
        ws.send({ type: "cancel" });
      } else {
        onBack();
      }
    }
    if (
      input === "m" &&
      !isStreaming &&
      producerConnected &&
      ws &&
      !showFileSearch &&
      !showSkills
    ) {
      const nextIdx = (MODES.indexOf(mode) + 1) % MODES.length;
      const nextMode = MODES[nextIdx];
      setMode(nextMode);
      ws.send({ type: "set_mode", mode: nextMode });
    }
    if (
      input === "/" &&
      !isStreaming &&
      !showFileSearch &&
      !showSkills &&
      inputValue === "" &&
      skills.length > 0
    ) {
      setShowSkills(true);
    }
  });

  const handleSend = useCallback(
    (text: string) => {
      if (!ws || !connected) return;

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; imageData: string; mimeType: string }
      > = [];
      if (text.trim()) content.push({ type: "text", text });
      for (const img of pendingImages) {
        content.push({
          type: "image",
          imageData: img.dataUrl,
          mimeType: img.mimeType,
        });
      }
      if (content.length === 0) return;

      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        chatId: chat.id,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      ws.send({
        type: "send_message",
        content,
      });
      setInputValue("");
      setPendingImages([]);
    },
    [ws, connected, chat.id, pendingImages],
  );

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    // Detect @ for file search
    if (
      value.endsWith("@") &&
      (value.length === 1 || value[value.length - 2] === " ")
    ) {
      setShowFileSearch(true);
      setShowSkills(false);
    }
  }, []);

  const handleFileSearch = useCallback(
    (query: string, searchType: "filename" | "content") => {
      if (!ws) return;
      setFileSearchLoading(true);
      ws.send({ type: "file_search", query, searchType });
    },
    [ws],
  );

  const handleFileSearchSelect = useCallback(
    (result: FileSearchResult) => {
      const ref = result.lineNumber
        ? `@${result.path}#${result.lineNumber}`
        : `@${result.path}`;
      // Replace trailing @ with the selected reference
      const atIdx = inputValue.lastIndexOf("@");
      const newValue =
        atIdx >= 0
          ? inputValue.substring(0, atIdx) + ref + " "
          : inputValue + ref + " ";
      setInputValue(newValue);
      setShowFileSearch(false);
    },
    [inputValue],
  );

  const handleSkillInvoke = useCallback(
    (skillId: string) => {
      if (!ws) return;
      ws.send({ type: "invoke_skill", skillId });
      setShowSkills(false);
      setInputValue("");
    },
    [ws],
  );

  const handlePaste = useCallback(async () => {
    const result = await fetchClipboard();
    if (!result) return;
    if (result.type === "text" && result.text) {
      setInputValue((prev) => prev + result.text);
    } else if (result.type === "image" && result.imageData && result.mimeType) {
      setPendingImages((prev) => [
        ...prev,
        {
          id: `img-${Date.now()}`,
          mimeType: result.mimeType!,
          dataUrl: result.imageData!,
        },
      ]);
    }
  }, []);

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
          <Text
            color={
              mode === "plan"
                ? "yellow"
                : mode === "human_confirm"
                  ? "magenta"
                  : "green"
            }
          >
            [{MODE_LABELS[mode]}]
          </Text>
          <Text color={producerConnected ? "green" : "red"}>
            {producerConnected ? "● client" : "○ no client"}
          </Text>
          <Text dimColor>{connected ? "● ws" : "○ ws"}</Text>
        </Box>
      </Box>

      {!producerConnected && (
        <Box marginBottom={1}>
          <Text color="yellow">
            No local client connected. Run `claude-chat-client --chat {chat.id}`
            to start.
          </Text>
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

      {showFileSearch && (
        <FileSearchOverlay
          results={fileSearchResults}
          loading={fileSearchLoading}
          searchType="filename"
          onSearch={handleFileSearch}
          onSelect={handleFileSearchSelect}
          onClose={() => setShowFileSearch(false)}
        />
      )}

      {showSkills && skills.length > 0 && (
        <SkillsOverlay
          skills={skills}
          onInvoke={handleSkillInvoke}
          onClose={() => setShowSkills(false)}
        />
      )}

      {pendingImages.length > 0 && (
        <Box gap={1}>
          {pendingImages.map((img, idx) => (
            <Text key={img.id} color="cyan">
              [Image {idx + 1}]
            </Text>
          ))}
          <Text dimColor>(Backspace when input empty to remove)</Text>
        </Box>
      )}

      <Input
        onSubmit={handleSend}
        disabled={isStreaming || !connected || !producerConnected}
        value={inputValue}
        onChange={handleInputChange}
        onPaste={handlePaste}
      />

      <Box marginTop={1}>
        <Text dimColor>
          Esc {isStreaming ? "cancel" : "back"} m mode / skills
        </Text>
      </Box>
    </Box>
  );
}
