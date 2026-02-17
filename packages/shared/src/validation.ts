import type { MessageContent, MessageMetadata } from "./types/message.js";
import type {
  WSViewerEvent,
  WSProducerEvent,
  FileSearchResult,
  Skill,
} from "./types/ws.js";
import {
  MAX_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES,
  MAX_MESSAGE_LENGTH,
  MAX_FILE_SEARCH_QUERY_LENGTH,
  VALID_AGENT_MODES,
  MAX_FILE_SEARCH_RESULTS,
} from "./constants.js";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripDangerousKeys(obj: unknown): unknown {
  if (!isObject(obj)) return obj;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype")
      continue;
    cleaned[key] =
      isObject(value) || Array.isArray(value)
        ? stripDangerousKeys(value)
        : value;
  }
  return cleaned;
}

export function sanitizeObject<T>(obj: T): T {
  return stripDangerousKeys(obj) as T;
}

export function validateMessageContent(
  content: unknown,
): content is MessageContent[] {
  if (!Array.isArray(content)) return false;
  for (const item of content) {
    if (!isObject(item)) return false;
    if (item.type !== "text" && item.type !== "image") return false;
    if (item.type === "text") {
      if (typeof item.text !== "string") return false;
      if (item.text.length > MAX_MESSAGE_LENGTH) return false;
    }
    if (item.type === "image") {
      if (typeof item.imageData !== "string") return false;
      // Base64 size is roughly 4/3 of the original
      const estimatedSize = (item.imageData.length * 3) / 4;
      if (estimatedSize > MAX_IMAGE_SIZE) return false;
      if (
        item.mimeType &&
        !ALLOWED_IMAGE_TYPES.includes(item.mimeType as string)
      )
        return false;
    }
  }
  return true;
}

export function validateViewerEvent(data: unknown): WSViewerEvent {
  if (!isObject(data))
    throw new ValidationError("Invalid event: not an object");
  const type = data.type;

  if (type === "send_message") {
    if (!validateMessageContent(data.content)) {
      throw new ValidationError("Invalid message content");
    }
    return { type: "send_message", content: data.content as MessageContent[] };
  }

  if (type === "cancel") {
    return { type: "cancel" };
  }

  if (type === "tool_approval_response") {
    const response = data.response;
    if (!isObject(response))
      throw new ValidationError("Invalid tool approval response");
    if (typeof response.requestId !== "string")
      throw new ValidationError("Missing requestId");
    if (typeof response.approved !== "boolean")
      throw new ValidationError("Missing approved");
    return {
      type: "tool_approval_response",
      response: {
        requestId: response.requestId as string,
        approved: response.approved as boolean,
        alwaysAllow:
          typeof response.alwaysAllow === "boolean"
            ? response.alwaysAllow
            : undefined,
        message:
          typeof response.message === "string" ? response.message : undefined,
      },
    };
  }

  if (type === "file_search") {
    if (typeof data.query !== "string" || data.query.length === 0) {
      throw new ValidationError("Missing or empty file search query");
    }
    if (data.query.length > MAX_FILE_SEARCH_QUERY_LENGTH) {
      throw new ValidationError("File search query too long");
    }
    if (data.searchType !== "filename" && data.searchType !== "content") {
      throw new ValidationError(
        "Invalid searchType: must be 'filename' or 'content'",
      );
    }
    return {
      type: "file_search",
      query: data.query as string,
      searchType: data.searchType as "filename" | "content",
    };
  }

  if (type === "set_mode") {
    if (!VALID_AGENT_MODES.includes(data.mode as any)) {
      throw new ValidationError(
        `Invalid mode: must be one of ${VALID_AGENT_MODES.join(", ")}`,
      );
    }
    return {
      type: "set_mode",
      mode: data.mode as "plan" | "human_confirm" | "accept_all",
    };
  }

  if (type === "invoke_skill") {
    if (typeof data.skillId !== "string" || data.skillId.length === 0) {
      throw new ValidationError("Missing skillId");
    }
    return { type: "invoke_skill", skillId: data.skillId as string };
  }

  throw new ValidationError(`Unknown event type: ${String(type)}`);
}

export function validateProducerEvent(data: unknown): WSProducerEvent {
  if (!isObject(data))
    throw new ValidationError("Invalid event: not an object");
  const type = data.type;

  if (type === "heartbeat") return { type: "heartbeat" };

  if (type === "message_start") {
    if (typeof data.messageId !== "string")
      throw new ValidationError("Missing messageId");
    return { type: "message_start", messageId: data.messageId };
  }

  if (type === "message_delta") {
    if (typeof data.messageId !== "string")
      throw new ValidationError("Missing messageId");
    if (typeof data.delta !== "string")
      throw new ValidationError("Missing delta");
    return {
      type: "message_delta",
      messageId: data.messageId,
      delta: data.delta,
    };
  }

  if (type === "status") {
    const validStatuses = ["thinking", "tool_use", "responding", "idle"];
    if (!validStatuses.includes(data.status as string))
      throw new ValidationError("Invalid status");
    return {
      type: "status",
      status: data.status as "thinking" | "tool_use" | "responding" | "idle",
    };
  }

  if (type === "error") {
    return {
      type: "error",
      error: typeof data.error === "string" ? data.error : "Unknown error",
      code: typeof data.code === "string" ? data.code : undefined,
    };
  }

  if (type === "tool_use") {
    if (typeof data.toolName !== "string")
      throw new ValidationError("Missing toolName");
    return {
      type: "tool_use",
      toolName: data.toolName,
      toolInput: sanitizeObject(data.toolInput),
    };
  }

  if (type === "tool_approval_request") {
    const request = data.request;
    if (!isObject(request))
      throw new ValidationError("Invalid tool approval request");
    if (typeof request.requestId !== "string")
      throw new ValidationError("Missing requestId");
    if (typeof request.toolName !== "string")
      throw new ValidationError("Missing toolName");
    return {
      type: "tool_approval_request",
      request: {
        requestId: request.requestId,
        toolName: request.toolName,
        toolInput: sanitizeObject(request.toolInput),
      },
    };
  }

  if (type === "message_complete") {
    const msg = data.message;
    if (!isObject(msg)) throw new ValidationError("Invalid message");
    if (typeof msg.id !== "string")
      throw new ValidationError("Missing message id");
    if (typeof msg.role !== "string") throw new ValidationError("Missing role");
    if (!validateMessageContent(msg.content))
      throw new ValidationError("Invalid message content");
    return {
      type: "message_complete",
      message: {
        id: msg.id as string,
        chatId: (msg.chatId as string) || "",
        role: msg.role as "user" | "assistant",
        content: msg.content as MessageContent[],
        createdAt: (msg.createdAt as string) || new Date().toISOString(),
        metadata: isObject(msg.metadata)
          ? (msg.metadata as MessageMetadata)
          : undefined,
      },
      sessionId:
        typeof data.sessionId === "string" ? data.sessionId : undefined,
    };
  }

  if (type === "file_search_results") {
    if (!Array.isArray(data.results))
      throw new ValidationError("Missing results array");
    if (typeof data.query !== "string")
      throw new ValidationError("Missing query");
    if (data.searchType !== "filename" && data.searchType !== "content") {
      throw new ValidationError("Invalid searchType");
    }
    const results: FileSearchResult[] = (data.results as unknown[])
      .slice(0, MAX_FILE_SEARCH_RESULTS)
      .map((r) => {
        if (!isObject(r) || typeof r.path !== "string")
          throw new ValidationError("Invalid file search result");
        return {
          path: r.path as string,
          type:
            r.type === "content_match"
              ? ("content_match" as const)
              : ("file" as const),
          lineNumber:
            typeof r.lineNumber === "number" ? r.lineNumber : undefined,
          lineContent:
            typeof r.lineContent === "string" ? r.lineContent : undefined,
          preview: typeof r.preview === "string" ? r.preview : undefined,
        };
      });
    return {
      type: "file_search_results",
      results,
      query: data.query as string,
      searchType: data.searchType as "filename" | "content",
    };
  }

  if (type === "register_skills") {
    if (!Array.isArray(data.skills))
      throw new ValidationError("Missing skills array");
    const skills: Skill[] = (data.skills as unknown[]).map((s) => {
      if (!isObject(s)) throw new ValidationError("Invalid skill");
      if (typeof s.id !== "string")
        throw new ValidationError("Missing skill id");
      if (typeof s.name !== "string")
        throw new ValidationError("Missing skill name");
      if (typeof s.description !== "string")
        throw new ValidationError("Missing skill description");
      return {
        id: s.id as string,
        name: s.name as string,
        description: s.description as string,
      };
    });
    return { type: "register_skills", skills };
  }

  throw new ValidationError(`Unknown producer event type: ${String(type)}`);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
