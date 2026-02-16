import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import type {
  WSViewerEvent,
  WSServerToViewerEvent,
  WSProducerEvent,
} from "@ccluster/shared";

export function createWsRoutes(upgradeWebSocket: any) {
  const ws = new Hono<AppEnv>();

  ws.get("/chats/:id/ws", upgradeWebSocket((c: any) => {
    const chatId = c.req.param("id");
    const role = c.req.query("role") || "viewer";
    const repo = c.get("repo");
    const connectionManager = c.get("connectionManager");
    const userId = c.get("userId");

    if (role === "producer") {
      // ─── Producer Connection ───
      const hostname = c.req.query("hostname") || "unknown";
      const cwd = c.req.query("cwd") || "unknown";
      const hitl = c.req.query("hitl") === "true";

      return {
        async onOpen(_evt: any, wsCtx: any) {
          const chat = await repo.getChat(chatId, userId);
          if (!chat) {
            wsCtx.send(JSON.stringify({ type: "error", error: "Chat not found" }));
            wsCtx.close();
            return;
          }

          const registered = connectionManager.registerProducer(chatId, wsCtx, userId, { hostname, cwd, hitl });
          if (!registered) {
            wsCtx.send(JSON.stringify({ type: "error", error: "Producer already connected", code: "PRODUCER_EXISTS" }));
            wsCtx.close();
            return;
          }

          console.log(`Producer connected: chat ${chatId} (user ${userId}, host ${hostname}${hitl ? ", hitl" : ""})`);
        },

        async onMessage(evt: any, _wsCtx: any) {
          try {
            const event: WSProducerEvent = JSON.parse(
              typeof evt.data === "string" ? evt.data : evt.data.toString()
            );

            if (event.type === "heartbeat") {
              connectionManager.handleProducerHeartbeat(chatId);
              return;
            }

            // Relay tool approval requests to viewers
            if (event.type === "tool_approval_request") {
              connectionManager.broadcastToViewers(chatId, event as unknown as WSServerToViewerEvent);
              return;
            }

            if (event.type === "message_complete") {
              // Persist assistant message to DB
              const content = event.message.content;
              const metadata = event.message.metadata;
              const assistantMsg = await repo.addMessage(chatId, "assistant", content, metadata);

              // Update session ID if provided
              if (event.sessionId) {
                await repo.setChatSession(chatId, event.sessionId);
              }

              // Auto-title: if chat has no session yet, set title from first response
              const chat = await repo.getChat(chatId, userId);
              if (chat && !chat.sessionId) {
                const text = content.find((c: any) => c.type === "text")?.text || "";
                const title = text.substring(0, 50).split("\n")[0] || "Chat";
                await repo.updateChat(chatId, userId, { title });
              }

              // Relay to viewers with the persisted message
              const viewerEvent: WSServerToViewerEvent = {
                type: "message_complete",
                message: assistantMsg,
              };
              connectionManager.broadcastToViewers(chatId, viewerEvent);
              return;
            }

            // Relay all other events directly to viewers
            connectionManager.broadcastToViewers(chatId, event as WSServerToViewerEvent);
          } catch (err: any) {
            console.error(`Producer message error (chat ${chatId}):`, err.message);
          }
        },

        onClose() {
          console.log(`Producer disconnected: chat ${chatId}`);
          connectionManager.removeProducer(chatId);
        },
      };
    }

    // ─── Viewer Connection ───
    return {
      async onOpen(_evt: any, wsCtx: any) {
        const chat = await repo.getChat(chatId, userId);
        if (!chat) {
          const errorEvent: WSServerToViewerEvent = { type: "error", error: "Chat not found" };
          wsCtx.send(JSON.stringify(errorEvent));
          wsCtx.close();
          return;
        }

        connectionManager.addViewer(chatId, wsCtx, userId);
        console.log(`Viewer connected: chat ${chatId} (user ${userId})`);
      },

      async onMessage(evt: any, _wsCtx: any) {
        try {
          const event: WSViewerEvent = JSON.parse(
            typeof evt.data === "string" ? evt.data : evt.data.toString()
          );

          if (event.type === "send_message") {
            // Verify chat ownership
            const chat = await repo.getChat(chatId, userId);
            if (!chat) {
              connectionManager.broadcastToViewers(chatId, { type: "error", error: "Chat not found" });
              return;
            }

            // Persist user message
            const userMsg = await repo.addMessage(chatId, "user", event.content);

            // Notify all viewers the user message has been stored
            connectionManager.broadcastToViewers(chatId, {
              type: "user_message_stored",
              message: userMsg,
            });

            // Check if a producer is connected
            if (!connectionManager.isProducerConnected(chatId)) {
              connectionManager.broadcastToViewers(chatId, {
                type: "error",
                error: "No local client connected. Run `claude-chat-client --chat <id>` to start.",
                code: "NO_PRODUCER",
              });
              return;
            }

            // Get session ID and message history for the producer
            const sessionId = chat.sessionId || null;
            const history = await repo.getMessages(chatId);

            // Send process request to producer
            connectionManager.sendToProducer(chatId, {
              type: "process_message",
              chatId,
              content: event.content,
              sessionId,
              messageHistory: history,
            });
          }

          if (event.type === "tool_approval_response") {
            // Relay approval response to producer
            connectionManager.sendToProducer(chatId, {
              type: "tool_approval_response",
              response: event.response,
            });
          }

          if (event.type === "cancel") {
            connectionManager.sendToProducer(chatId, { type: "cancel" });
          }
        } catch (err: any) {
          connectionManager.broadcastToViewers(chatId, {
            type: "error",
            error: err.message || "Unknown error",
          });
        }
      },

      onClose(_evt: any, wsCtx: any) {
        console.log(`Viewer disconnected: chat ${chatId}`);
        connectionManager.removeViewer(chatId, wsCtx);
      },
    };
  }));

  return ws;
}
