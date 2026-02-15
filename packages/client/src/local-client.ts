import WebSocket from "ws";
import { hostname } from "os";
import type {
  WSServerToProducerEvent,
  WSProducerEvent,
} from "@claude-chat/shared";
import { WS_HEARTBEAT_INTERVAL } from "@claude-chat/shared";
import { runClaude } from "./claude-runner.js";

export interface LocalClientOptions {
  serverUrl: string;
  chatId: string;
  apiKey: string;
  anthropicApiKey: string;
  cwd: string;
}

export class LocalClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;
  private reconnecting = false;
  private shouldRun = true;
  private options: LocalClientOptions;

  constructor(options: LocalClientOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    this.shouldRun = true;
    return this.doConnect();
  }

  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { serverUrl, chatId, apiKey, cwd } = this.options;
      const wsUrl = serverUrl.replace(/^http/, "ws");
      const host = hostname();
      const url = `${wsUrl}/api/chats/${chatId}/ws?token=${encodeURIComponent(apiKey)}&role=producer&hostname=${encodeURIComponent(host)}&cwd=${encodeURIComponent(cwd)}`;

      const ws = new WebSocket(url);
      this.ws = ws;

      ws.on("open", () => {
        console.log(`Connected to server as producer for chat ${chatId}`);
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

  private async handleServerEvent(event: WSServerToProducerEvent): Promise<void> {
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
          })) {
            this.send(producerEvent);
          }
        } catch (err: any) {
          if (err.name !== "AbortError") {
            this.send({ type: "error", error: err.message || "Unknown error" });
          }
        }

        this.abortController = null;
        break;
      }

      case "cancel": {
        if (this.abortController) {
          console.log("Cancelling current operation");
          this.abortController.abort();
          this.abortController = null;
        }
        break;
      }
    }
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
