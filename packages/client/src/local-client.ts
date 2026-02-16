import WebSocket from "ws";
import { hostname } from "os";
import type {
  WSServerToProducerEvent,
  WSProducerEvent,
  ToolApprovalRequest,
  ToolApprovalResponse,
} from "@ccluster/shared";
import { WS_HEARTBEAT_INTERVAL } from "@ccluster/shared";
import { runClaude } from "./claude-runner.js";

export interface LocalClientOptions {
  serverUrl: string;
  chatId?: string;
  apiKey: string;
  anthropicApiKey?: string;
  cwd: string;
  humanInTheLoop?: boolean;
  chatName?: string;
}

export class LocalClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;
  private reconnecting = false;
  private shouldRun = true;
  private options: LocalClientOptions;
  private _chatId: string | undefined;
  private pendingApprovals = new Map<
    string,
    { resolve: (response: ToolApprovalResponse) => void }
  >();

  constructor(options: LocalClientOptions) {
    this.options = options;
    this._chatId = options.chatId;
  }

  get chatId(): string | undefined {
    return this._chatId;
  }

  private async createChat(): Promise<string> {
    const { serverUrl, apiKey } = this.options;
    const res = await fetch(`${serverUrl}/api/chats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(this.options.chatName ? { title: this.options.chatName } : {}),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        `Failed to create chat: ${(body as any).error || res.statusText}`
      );
    }

    const json = (await res.json()) as { data: { id: string } };
    return json.data.id;
  }

  async connect(): Promise<void> {
    this.shouldRun = true;
    if (!this._chatId) {
      this._chatId = await this.createChat();
    }
    return this.doConnect();
  }

  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { serverUrl, apiKey, cwd } = this.options;
      const chatId = this._chatId!;
      const wsUrl = serverUrl.replace(/^http/, "ws");
      const host = hostname();
      const hitl = this.options.humanInTheLoop ? "&hitl=true" : "";
      const url = `${wsUrl}/api/chats/${chatId}/ws?token=${encodeURIComponent(apiKey)}&role=producer&hostname=${encodeURIComponent(host)}&cwd=${encodeURIComponent(cwd)}${hitl}`;

      const ws = new WebSocket(url);
      this.ws = ws;

      ws.on("open", () => {
        console.log(`Connected to server as producer for chat ${chatId}`);
        if (this.options.humanInTheLoop) {
          console.log("Human-in-the-loop: enabled (write/exec tools require approval)");
        }
        this.startHeartbeat();
        resolve();
      });

      ws.on("message", async (data) => {
        try {
          const event: WSServerToProducerEvent = JSON.parse(data.toString());
          await this.handleServerEvent(event);
        } catch (err: any) {
          console.error("Error handling server event:", err.message);
        }
      });

      ws.on("close", () => {
        console.log("Disconnected from server");
        this.stopHeartbeat();
        this.ws = null;

        // Reject any pending approvals
        for (const [id, pending] of this.pendingApprovals) {
          pending.resolve({
            requestId: id,
            approved: false,
            message: "Connection lost",
          });
        }
        this.pendingApprovals.clear();

        if (this.shouldRun && !this.reconnecting) {
          this.reconnecting = true;
          console.log("Reconnecting in 3 seconds...");
          setTimeout(() => {
            this.reconnecting = false;
            if (this.shouldRun) {
              this.doConnect().catch((err) => {
                console.error("Reconnect failed:", err.message);
              });
            }
          }, 3000);
        }
      });

      ws.on("error", (err) => {
        if (!this.reconnecting) {
          console.error("WebSocket error:", err.message);
        }
        // The close event will handle reconnection
        reject(err);
      });
    });
  }

  private async handleServerEvent(
    event: WSServerToProducerEvent
  ): Promise<void> {
    switch (event.type) {
      case "process_message": {
        // Cancel any running session
        if (this.abortController) {
          this.abortController.abort();
        }

        this.abortController = new AbortController();

        console.log(`Processing message for chat ${event.chatId}`);

        try {
          for await (const producerEvent of runClaude({
            content: event.content,
            sessionId: event.sessionId,
            anthropicApiKey: this.options.anthropicApiKey,
            cwd: this.options.cwd,
            abortSignal: this.abortController.signal,
            humanInTheLoop: this.options.humanInTheLoop,
            onToolApproval: this.options.humanInTheLoop
              ? (request) => this.requestToolApproval(request)
              : undefined,
          })) {
            this.send(producerEvent);
          }
        } catch (err: any) {
          if (err.name !== "AbortError") {
            this.send({
              type: "error",
              error: err.message || "Unknown error",
            });
          }
        }

        this.abortController = null;
        break;
      }

      case "tool_approval_response": {
        const pending = this.pendingApprovals.get(event.response.requestId);
        if (pending) {
          this.pendingApprovals.delete(event.response.requestId);
          pending.resolve(event.response);
        }
        break;
      }

      case "cancel": {
        if (this.abortController) {
          console.log("Cancelling current operation");
          this.abortController.abort();
          this.abortController = null;
        }
        // Also reject pending approvals on cancel
        for (const [id, pending] of this.pendingApprovals) {
          pending.resolve({
            requestId: id,
            approved: false,
            message: "Operation cancelled",
          });
        }
        this.pendingApprovals.clear();
        break;
      }
    }
  }

  private requestToolApproval(
    request: ToolApprovalRequest
  ): Promise<ToolApprovalResponse> {
    return new Promise((resolve) => {
      this.pendingApprovals.set(request.requestId, { resolve });
      this.send({ type: "tool_approval_request", request });
    });
  }

  private send(event: WSProducerEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "heartbeat" });
    }, WS_HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  disconnect(): void {
    this.shouldRun = false;
    this.stopHeartbeat();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    // Reject pending approvals
    for (const [id, pending] of this.pendingApprovals) {
      pending.resolve({
        requestId: id,
        approved: false,
        message: "Client disconnected",
      });
    }
    this.pendingApprovals.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
