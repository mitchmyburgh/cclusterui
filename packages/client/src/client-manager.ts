import { query } from "@anthropic-ai/claude-agent-sdk";
import type { MessageContent } from "@claude-chat/shared";

export interface StreamCallbacks {
  onTextDelta: (delta: string) => void;
  onToolUse: (toolName: string, toolInput: unknown) => void;
  onComplete: (result: {
    text: string;
    sessionId: string;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    model: string;
  }) => void;
  onError: (error: string) => void;
  onStatus: (status: "thinking" | "tool_use" | "responding") => void;
}

interface ActiveSession {
  abortController: AbortController;
}

export class ClientManager {
  private sessions: Map<string, ActiveSession> = new Map();
  private anthropicApiKey: string;
  private cwd: string;

  constructor(config: { anthropicApiKey: string; cwd: string }) {
    this.anthropicApiKey = config.anthropicApiKey;
    this.cwd = config.cwd;
  }

  async sendMessage(
    chatId: string,
    content: MessageContent[],
    existingSessionId: string | null,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const abortController = new AbortController();
    this.sessions.set(chatId, { abortController });

    // Build the text prompt from content
    const textParts = content.filter(c => c.type === "text" && c.text).map(c => c.text!);
    const prompt = textParts.join("\n") || "Please analyze the attached image(s).";

    try {
      callbacks.onStatus("thinking");

      const queryOptions: Record<string, unknown> = {
        abortController,
        permissionMode: "bypassPermissions" as const,
        allowDangerouslySkipPermissions: true,
        allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch"],
        cwd: this.cwd,
        env: { ...process.env, ANTHROPIC_API_KEY: this.anthropicApiKey },
        maxTurns: 50,
        includePartialMessages: true,
      };

      if (existingSessionId) {
        queryOptions.resume = existingSessionId;
      }

      let sessionId = existingSessionId || "";
      let resultText = "";

      for await (const message of query({ prompt, options: queryOptions as any })) {
        if (abortController.signal.aborted) break;

        if (message.type === "system" && "subtype" in message && message.subtype === "init") {
          sessionId = message.session_id;
        }

        if (message.type === "stream_event" && "event" in message) {
          const event = message.event as any;
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            callbacks.onStatus("responding");
            callbacks.onTextDelta(event.delta.text);
            resultText += event.delta.text;
          }
        }

        if (message.type === "assistant" && "message" in message) {
          const msg = message.message as any;
          if (msg?.content) {
            for (const block of msg.content) {
              if (block.type === "tool_use") {
                callbacks.onStatus("tool_use");
                callbacks.onToolUse(block.name, block.input);
              }
            }
          }
        }

        if (message.type === "result") {
          if ("result" in message && message.result) {
            resultText = resultText || (message as any).result;
          }
          const isSuccess = "subtype" in message && message.subtype === "success";
          if (isSuccess) {
            const r = message as any;
            callbacks.onComplete({
              text: resultText,
              sessionId,
              costUsd: r.total_cost_usd || 0,
              inputTokens: r.usage?.input_tokens || 0,
              outputTokens: r.usage?.output_tokens || 0,
              durationMs: r.duration_ms || 0,
              model: Object.keys(r.modelUsage || {})[0] || "unknown",
            });
          } else {
            const errors = (message as any).errors || [];
            callbacks.onError(errors.join("; ") || "Agent execution failed");
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        callbacks.onError(err.message || "Unknown error");
      }
    } finally {
      this.sessions.delete(chatId);
    }
  }

  cancelChat(chatId: string): void {
    const session = this.sessions.get(chatId);
    if (session) {
      session.abortController.abort();
      this.sessions.delete(chatId);
    }
  }

  async destroy(): Promise<void> {
    for (const [, session] of this.sessions) {
      session.abortController.abort();
    }
    this.sessions.clear();
  }
}
