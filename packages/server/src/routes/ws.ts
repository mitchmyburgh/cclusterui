import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import type { WSClientEvent, WSServerEvent } from "@claude-chat/shared";

// This function receives the upgradeWebSocket helper from the entry point
export function createWsRoutes(upgradeWebSocket: any) {
  const ws = new Hono<AppEnv>();

  ws.get("/chats/:id/ws", upgradeWebSocket((c: any) => {
    const chatId = c.req.param("id");
    const repo = c.get("repo");
    const clientManager = c.get("clientManager");
    const userId = c.get("userId");

    return {
      async onOpen(_evt: any, wsCtx: any) {
        // Verify chat ownership
        const chat = await repo.getChat(chatId, userId);
        if (!chat) {
          const errorEvent: WSServerEvent = { type: "error", error: "Chat not found" };
          wsCtx.send(JSON.stringify(errorEvent));
          wsCtx.close();
          return;
        }
        console.log(`WS connected: chat ${chatId} (user ${userId})`);
      },

      async onMessage(evt: any, wsCtx: any) {
        try {
          const event: WSClientEvent = JSON.parse(typeof evt.data === "string" ? evt.data : evt.data.toString());

          if (event.type === "send_message") {
            // Verify chat ownership
            const chat = await repo.getChat(chatId, userId);
            if (!chat) {
              const errorEvent: WSServerEvent = { type: "error", error: "Chat not found" };
              wsCtx.send(JSON.stringify(errorEvent));
              return;
            }

            // Persist user message
            const userMsg = await repo.addMessage(chatId, "user", event.content);

            // Get chat session ID
            const sessionId = chat.sessionId || null;

            // Generate message ID for streaming
            const assistantMsgId = crypto.randomUUID();

            // Send message_start
            const startEvent: WSServerEvent = { type: "message_start", messageId: assistantMsgId };
            wsCtx.send(JSON.stringify(startEvent));

            let fullText = "";

            // Send to Claude
            await clientManager.sendMessage(chatId, event.content, sessionId, {
              onTextDelta(delta: string) {
                fullText += delta;
                const deltaEvent: WSServerEvent = { type: "message_delta", messageId: assistantMsgId, delta };
                wsCtx.send(JSON.stringify(deltaEvent));
              },
              onToolUse(toolName: string, toolInput: unknown) {
                const toolEvent: WSServerEvent = { type: "tool_use", toolName, toolInput };
                wsCtx.send(JSON.stringify(toolEvent));
              },
              onStatus(status: "thinking" | "tool_use" | "responding") {
                const statusEvent: WSServerEvent = { type: "status", status };
                wsCtx.send(JSON.stringify(statusEvent));
              },
              async onComplete(result: {
                text: string;
                sessionId: string;
                costUsd: number;
                inputTokens: number;
                outputTokens: number;
                durationMs: number;
                model: string;
              }) {
                // Persist assistant message
                const assistantMsg = await repo.addMessage(chatId, "assistant",
                  [{ type: "text", text: result.text }],
                  {
                    totalCostUsd: result.costUsd,
                    inputTokens: result.inputTokens,
                    outputTokens: result.outputTokens,
                    durationMs: result.durationMs,
                    model: result.model,
                  }
                );

                // Update chat session ID
                if (result.sessionId) {
                  await repo.setChatSession(chatId, result.sessionId);
                }

                // Update chat title if it's the first message
                if (!chat?.sessionId) {
                  const title = result.text.substring(0, 50).split("\n")[0] || "Chat";
                  await repo.updateChat(chatId, userId, { title });
                }

                const completeEvent: WSServerEvent = { type: "message_complete", message: assistantMsg };
                wsCtx.send(JSON.stringify(completeEvent));
              },
              onError(error: string) {
                const errorEvent: WSServerEvent = { type: "error", error };
                wsCtx.send(JSON.stringify(errorEvent));
              },
            });
          }

          if (event.type === "cancel") {
            clientManager.cancelChat(chatId);
          }
        } catch (err: any) {
          const errorEvent: WSServerEvent = { type: "error", error: err.message || "Unknown error" };
          wsCtx.send(JSON.stringify(errorEvent));
        }
      },

      onClose() {
        console.log(`WS disconnected: chat ${chatId}`);
      },
    };
  }));

  return ws;
}
