import { useRef, useState, useEffect, useCallback } from "react";
import type { WSClientEvent, WSServerEvent } from "@claude-chat/shared";

export function useWebSocket(chatId: string, apiKey: string, onEvent: (event: WSServerEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/chats/${chatId}/ws?token=${encodeURIComponent(apiKey)}`;

    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let ws: WebSocket;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts = 0;
      };

      ws.onmessage = (evt) => {
        try {
          const event: WSServerEvent = JSON.parse(evt.data);
          onEventRef.current(event);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimer = setTimeout(() => { reconnectAttempts++; connect(); }, delay);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [chatId, apiKey]);

  const send = useCallback((event: WSClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  return { connected, send };
}
