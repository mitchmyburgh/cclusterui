import type { Message, MessageContent } from "./message.js";

// ─── Tool Approval ───

export interface ToolApprovalRequest {
  requestId: string;
  toolName: string;
  toolInput: unknown;
}

export interface ToolApprovalResponse {
  requestId: string;
  approved: boolean;
  alwaysAllow?: boolean;
  message?: string;
}

// ─── Viewer (Web UI / TUI) → Server ───

export type WSViewerEvent =
  | { type: "send_message"; content: MessageContent[] }
  | { type: "cancel" }
  | { type: "tool_approval_response"; response: ToolApprovalResponse };

/** @deprecated Use WSViewerEvent */
export type WSClientEvent = WSViewerEvent;

// ─── Server → Viewer ───

export type WSServerToViewerEvent =
  | { type: "message_start"; messageId: string }
  | { type: "message_delta"; messageId: string; delta: string }
  | { type: "message_complete"; message: Message }
  | { type: "tool_use"; toolName: string; toolInput: unknown }
  | { type: "error"; error: string; code?: string }
  | {
      type: "status";
      status: "thinking" | "tool_use" | "responding" | "idle";
    }
  | {
      type: "producer_status";
      connected: boolean;
      hostname?: string;
      cwd?: string;
      connectedAt?: string;
      hitl?: boolean;
    }
  | { type: "user_message_stored"; message: Message }
  | { type: "tool_approval_request"; request: ToolApprovalRequest };

/** @deprecated Use WSServerToViewerEvent */
export type WSServerEvent = WSServerToViewerEvent;

// ─── Server → Producer (Local Client) ───

export type WSServerToProducerEvent =
  | {
      type: "process_message";
      chatId: string;
      content: MessageContent[];
      sessionId: string | null;
      messageHistory: Message[];
    }
  | { type: "cancel" }
  | { type: "tool_approval_response"; response: ToolApprovalResponse };

// ─── Producer (Local Client) → Server ───

export type WSProducerEvent =
  | { type: "message_start"; messageId: string }
  | { type: "message_delta"; messageId: string; delta: string }
  | {
      type: "message_complete";
      message: Message;
      sessionId?: string;
    }
  | { type: "tool_use"; toolName: string; toolInput: unknown }
  | {
      type: "status";
      status: "thinking" | "tool_use" | "responding" | "idle";
    }
  | { type: "error"; error: string; code?: string }
  | { type: "heartbeat" }
  | { type: "tool_approval_request"; request: ToolApprovalRequest };
