import type { Message, MessageContent } from "./message.js";

// Client -> Server
export type WSClientEvent =
  | { type: "send_message"; content: MessageContent[] }
  | { type: "cancel" };

// Server -> Client
export type WSServerEvent =
  | { type: "message_start"; messageId: string }
  | { type: "message_delta"; messageId: string; delta: string }
  | { type: "message_complete"; message: Message }
  | { type: "tool_use"; toolName: string; toolInput: unknown }
  | { type: "error"; error: string; code?: string }
  | {
      type: "status";
      status: "thinking" | "tool_use" | "responding" | "idle";
    };
