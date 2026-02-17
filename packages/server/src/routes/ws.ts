import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import type { WSServerToViewerEvent, AgentMode } from "@mitchmyburgh/shared";
import {
  validateProducerEvent,
  validateViewerEvent,
  validateMessageContent,
  sanitizeObject,
  ValidationError,
  MAX_WS_MESSAGE_SIZE,
  VALID_AGENT_MODES,
} from "@mitchmyburgh/shared";

export function createWsRoutes(upgradeWebSocket: any) {
  const ws = new Hono<AppEnv>();

  ws.get(
    "/chats/:id/ws",
    upgradeWebSocket((c: any) => {
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
        const modeParam = c.req.query("mode");
        const mode: AgentMode | undefined = VALID_AGENT_MODES.includes(
          modeParam as any,
        )
          ? (modeParam as AgentMode)
          : undefined;

        return {
          async onOpen(_evt: any, wsCtx: any) {
            const chat = await repo.getChat(chatId, userId);
            if (!chat) {
              wsCtx.send(
                JSON.stringify({ type: "error", error: "Chat not found" }),
              );
              wsCtx.close();
              return;
            }

            const registered = connectionManager.registerProducer(
              chatId,
              wsCtx,
              userId,
              { hostname, cwd, hitl, mode },
            );
            if (!registered) {
              wsCtx.send(
                JSON.stringify({
                  type: "error",
                  error: "Producer already connected",
                  code: "PRODUCER_EXISTS",
                }),
              );
              wsCtx.close();
              return;
            }

            console.log(
              `Producer connected: chat ${chatId} (user ${userId}, host ${hostname}${hitl ? ", hitl" : ""})`,
            );
          },

          async onMessage(evt: any, _wsCtx: any) {
            try {
              const raw =
                typeof evt.data === "string" ? evt.data : evt.data.toString();

              // Enforce message size limit (M8)
              if (raw.length > MAX_WS_MESSAGE_SIZE) {
                console.error(
                  `Producer message too large (chat ${chatId}): ${raw.length} bytes`,
                );
                return;
              }

              const parsed = JSON.parse(raw);
              // Validate and sanitize producer event (C1, H4)
              const event = validateProducerEvent(sanitizeObject(parsed));

              if (event.type === "heartbeat") {
                connectionManager.handleProducerHeartbeat(chatId);
                return;
              }

              // Relay tool approval requests to viewers (sanitized)
              if (event.type === "tool_approval_request") {
                connectionManager.broadcastToViewers(
                  chatId,
                  event as unknown as WSServerToViewerEvent,
                );
                return;
              }

              // Handle skill registration from producer
              if (event.type === "register_skills") {
                connectionManager.setProducerSkills(chatId, event.skills);
                return;
              }

              // Relay file search results to viewers
              if (event.type === "file_search_results") {
                connectionManager.broadcastToViewers(
                  chatId,
                  event as unknown as WSServerToViewerEvent,
                );
                return;
              }

              if (event.type === "message_complete") {
                // Validate message content including image data (H5)
                if (!validateMessageContent(event.message.content)) {
                  console.error(
                    `Invalid message content from producer (chat ${chatId})`,
                  );
                  return;
                }

                const content = event.message.content;
                const metadata = event.message.metadata;
                const assistantMsg = await repo.addMessage(
                  chatId,
                  "assistant",
                  content,
                  metadata,
                );

                // Update session ID if provided - pass userId (C3)
                if (event.sessionId) {
                  await repo.setChatSession(chatId, event.sessionId, userId);
                }

                // Auto-title: if chat has no session yet, set title from first response
                const chat = await repo.getChat(chatId, userId);
                if (chat && !chat.sessionId) {
                  const text =
                    content.find((c: any) => c.type === "text")?.text || "";
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

              // Relay all other validated events directly to viewers
              connectionManager.broadcastToViewers(
                chatId,
                event as WSServerToViewerEvent,
              );
            } catch (err: any) {
              if (err instanceof ValidationError) {
                console.error(
                  `Invalid producer message (chat ${chatId}): ${err.message}`,
                );
              } else {
                console.error(
                  `Producer message error (chat ${chatId}):`,
                  err.message,
                );
              }
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
            const errorEvent: WSServerToViewerEvent = {
              type: "error",
              error: "Chat not found",
            };
            wsCtx.send(JSON.stringify(errorEvent));
            wsCtx.close();
            return;
          }

          connectionManager.addViewer(chatId, wsCtx, userId);
          console.log(`Viewer connected: chat ${chatId} (user ${userId})`);
        },

        async onMessage(evt: any, _wsCtx: any) {
          try {
            const raw =
              typeof evt.data === "string" ? evt.data : evt.data.toString();

            // Enforce message size limit (M8)
            if (raw.length > MAX_WS_MESSAGE_SIZE) {
              connectionManager.broadcastToViewers(chatId, {
                type: "error",
                error: "Message too large",
              });
              return;
            }

            const parsed = JSON.parse(raw);
            // Validate and sanitize viewer event (C1, H4)
            const event = validateViewerEvent(sanitizeObject(parsed));

            if (event.type === "send_message") {
              // Validate message content including image data (H5)
              if (!validateMessageContent(event.content)) {
                connectionManager.broadcastToViewers(chatId, {
                  type: "error",
                  error: "Invalid message content",
                });
                return;
              }

              // Verify chat ownership
              const chat = await repo.getChat(chatId, userId);
              if (!chat) {
                connectionManager.broadcastToViewers(chatId, {
                  type: "error",
                  error: "Chat not found",
                });
                return;
              }

              // Persist user message
              const userMsg = await repo.addMessage(
                chatId,
                "user",
                event.content,
              );

              // Notify all viewers the user message has been stored
              connectionManager.broadcastToViewers(chatId, {
                type: "user_message_stored",
                message: userMsg,
              });

              // Check if a producer is connected
              if (!connectionManager.isProducerConnected(chatId)) {
                connectionManager.broadcastToViewers(chatId, {
                  type: "error",
                  error:
                    "No local client connected. Run `claude-chat-client --chat <id>` to start.",
                  code: "NO_PRODUCER",
                });
                return;
              }

              // Get session ID and message history for the producer
              const sessionId = chat.sessionId || null;
              const { messages: history } = await repo.getMessages(chatId);

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

            if (event.type === "set_mode") {
              connectionManager.setProducerMode(chatId, event.mode);
              connectionManager.sendToProducer(chatId, {
                type: "set_mode",
                mode: event.mode,
              });
            }

            if (event.type === "file_search") {
              connectionManager.sendToProducer(chatId, {
                type: "file_search",
                query: event.query,
                searchType: event.searchType,
              });
            }

            if (event.type === "invoke_skill") {
              connectionManager.sendToProducer(chatId, {
                type: "invoke_skill",
                skillId: event.skillId,
              });
            }
          } catch (err: any) {
            const errorMsg =
              err instanceof ValidationError
                ? "Invalid message format"
                : "Failed to process message";
            connectionManager.broadcastToViewers(chatId, {
              type: "error",
              error: errorMsg,
            });
          }
        },

        onClose(_evt: any, wsCtx: any) {
          console.log(`Viewer disconnected: chat ${chatId}`);
          connectionManager.removeViewer(chatId, wsCtx);
        },
      };
    }),
  );

  return ws;
}
