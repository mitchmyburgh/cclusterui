import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  MessageContent,
  WSProducerEvent,
  ToolApprovalRequest,
  ToolApprovalResponse,
} from "@mitchmyburgh/shared";

export type ToolApprovalCallback = (
  request: ToolApprovalRequest
) => Promise<ToolApprovalResponse>;

export interface RunClaudeOptions {
  content: MessageContent[];
  sessionId: string | null;
  anthropicApiKey?: string;
  cwd: string;
  abortSignal?: AbortSignal;
  humanInTheLoop?: boolean;
  onToolApproval?: ToolApprovalCallback;
}

const AUTO_ALLOW_TOOLS = ["Read", "Glob", "Grep"];

export async function* runClaude(
  options: RunClaudeOptions
): AsyncGenerator<WSProducerEvent> {
  const {
    content,
    sessionId,
    anthropicApiKey,
    cwd,
    abortSignal,
    humanInTheLoop,
    onToolApproval,
  } = options;

  const abortController = new AbortController();

  // Wire up external abort signal
  if (abortSignal) {
    if (abortSignal.aborted) {
      abortController.abort();
    } else {
      abortSignal.addEventListener("abort", () => abortController.abort(), {
        once: true,
      });
    }
  }

  // Build the text prompt from content
  const textParts = content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!);
  const prompt = textParts.join("\n") || "Please analyze the attached image(s).";

  // Track tools the user has "always allowed"
  const alwaysAllowed = new Set<string>();

  const queryOptions: Record<string, unknown> = {
    abortController,
    allowedTools: [
      "Read",
      "Write",
      "Edit",
      "Bash",
      "Glob",
      "Grep",
      "WebSearch",
      "WebFetch",
    ],
    cwd,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      SHELL: process.env.SHELL,
      USER: process.env.USER,
      TERM: process.env.TERM,
      NODE_ENV: process.env.NODE_ENV,
      ANTHROPIC_API_KEY: anthropicApiKey || process.env.ANTHROPIC_API_KEY || "",
      CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN || "",
      CLAUDE_MODEL: process.env.CLAUDE_MODEL || "claude-opus-4-6",
    },
    maxTurns: 50,
    includePartialMessages: true,
  };

  if (humanInTheLoop && onToolApproval) {
    queryOptions.permissionMode = "default";
    queryOptions.canUseTool = async (
      toolName: string,
      input: unknown,
      _opts: unknown
    ) => {
      // Auto-allow read-only tools
      if (AUTO_ALLOW_TOOLS.includes(toolName)) {
        return { behavior: "allow", updatedInput: input };
      }
      // Auto-allow tools the user permanently approved this session
      if (alwaysAllowed.has(toolName)) {
        return { behavior: "allow", updatedInput: input };
      }

      const request: ToolApprovalRequest = {
        requestId: crypto.randomUUID(),
        toolName,
        toolInput: input,
      };

      const response = await onToolApproval(request);

      if (response.approved) {
        if (response.alwaysAllow) {
          alwaysAllowed.add(toolName);
        }
        return { behavior: "allow" as const, updatedInput: input };
      }
      return {
        behavior: "deny" as const,
        message: response.message || "User denied permission",
      };
    };
  } else {
    console.warn("WARNING: Running without human-in-the-loop. The agent can execute arbitrary commands.");
    console.warn("Use --hitl flag for safer operation.");
    queryOptions.permissionMode = "bypassPermissions";
    queryOptions.allowDangerouslySkipPermissions = true;
  }

  if (sessionId) {
    queryOptions.resume = sessionId;
  }

  const messageId = crypto.randomUUID();
  let currentSessionId = sessionId || "";
  let resultText = "";

  yield { type: "status", status: "thinking" };
  yield { type: "message_start", messageId };

  try {
    for await (const message of query({
      prompt,
      options: queryOptions as any,
    })) {
      if (abortController.signal.aborted) break;

      if (
        message.type === "system" &&
        "subtype" in message &&
        message.subtype === "init"
      ) {
        currentSessionId = message.session_id;
      }

      if (message.type === "stream_event" && "event" in message) {
        const event = message.event as any;
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          yield { type: "status", status: "responding" };
          yield {
            type: "message_delta",
            messageId,
            delta: event.delta.text,
          };
          resultText += event.delta.text;
        }
      }

      if (message.type === "assistant" && "message" in message) {
        const msg = message.message as any;
        if (msg?.content) {
          for (const block of msg.content) {
            if (block.type === "tool_use") {
              yield { type: "status", status: "tool_use" };
              yield {
                type: "tool_use",
                toolName: block.name,
                toolInput: block.input,
              };
            }
          }
        }
      }

      if (message.type === "result") {
        if ("result" in message && message.result) {
          resultText = resultText || (message as any).result;
        }
        const isSuccess =
          "subtype" in message && message.subtype === "success";
        if (isSuccess) {
          const r = message as any;
          yield {
            type: "message_complete",
            message: {
              id: messageId,
              chatId: "",
              role: "assistant",
              content: [{ type: "text", text: resultText }],
              createdAt: new Date().toISOString(),
              metadata: {
                totalCostUsd: r.total_cost_usd || 0,
                inputTokens: r.usage?.input_tokens || 0,
                outputTokens: r.usage?.output_tokens || 0,
                durationMs: r.duration_ms || 0,
                model:
                  Object.keys(r.modelUsage || {})[0] || "unknown",
              },
            },
            sessionId: currentSessionId,
          };
        } else {
          const errors = (message as any).errors || [];
          yield {
            type: "error",
            error: errors.join("; ") || "Agent execution failed",
          };
        }
      }
    }
  } catch (err: any) {
    if (err.name !== "AbortError") {
      yield { type: "error", error: err.message || "Unknown error" };
    }
  }

  yield { type: "status", status: "idle" };
}
