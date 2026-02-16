import WebSocket from "ws";
import type { WSViewerEvent, WSServerToViewerEvent } from "@mitchmyburgh/shared";

export interface WsClient {
  send: (event: WSViewerEvent) => void;
  close: () => void;
  onEvent: (handler: (event: WSServerToViewerEvent) => void) => void;
  onClose: (handler: () => void) => void;
  onOpen: (handler: () => void) => void;
}

export function connectWs(
  serverUrl: string,
  apiKey: string,
  chatId: string,
  role: "viewer" | "producer" = "viewer"
): WsClient {
  const wsUrl = serverUrl.replace(/^http/, "ws");
  const ws = new WebSocket(
    `${wsUrl}/api/chats/${chatId}/ws?token=${encodeURIComponent(apiKey)}&role=${role}`
  );

  let eventHandler: ((event: WSServerToViewerEvent) => void) | null = null;
  let closeHandler: (() => void) | null = null;
  let openHandler: (() => void) | null = null;

  ws.on("open", () => {
    openHandler?.();
  });

  ws.on("message", (data) => {
    if (eventHandler) {
      try {
        const event = JSON.parse(data.toString()) as WSServerToViewerEvent;
        eventHandler(event);
      } catch {
        // ignore parse errors
      }
    }
  });

  ws.on("close", () => {
    closeHandler?.();
  });

  return {
    send(event: WSViewerEvent) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    },
    close() {
      ws.close();
    },
    onEvent(handler) {
      eventHandler = handler;
    },
    onClose(handler) {
      closeHandler = handler;
    },
    onOpen(handler) {
      openHandler = handler;
    },
  };
}
