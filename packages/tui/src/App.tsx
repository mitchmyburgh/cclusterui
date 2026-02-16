import React, { useState, useCallback } from "react";
import { Box } from "ink";
import type { Chat } from "@ccluster/shared";
import { createApiClient } from "./api.js";
import { ChatListView } from "./views/ChatListView.js";
import { ChatView } from "./views/ChatView.js";

interface Props {
  serverUrl: string;
  apiKey: string;
}

type View = { type: "list" } | { type: "chat"; chat: Chat };

export function App({ serverUrl, apiKey }: Props) {
  const [view, setView] = useState<View>({ type: "list" });
  const api = createApiClient(serverUrl, apiKey);

  const handleSelectChat = useCallback((chat: Chat) => {
    setView({ type: "chat", chat });
  }, []);

  const handleBack = useCallback(() => {
    setView({ type: "list" });
  }, []);

  const handleQuit = useCallback(() => {
    process.exit(0);
  }, []);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {view.type === "list" ? (
        <ChatListView
          api={api}
          onSelectChat={handleSelectChat}
          onQuit={handleQuit}
        />
      ) : (
        <ChatView
          api={api}
          serverUrl={serverUrl}
          apiKey={apiKey}
          chat={view.chat}
          onBack={handleBack}
        />
      )}
    </Box>
  );
}
