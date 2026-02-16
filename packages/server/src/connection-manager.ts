import type {
  WSServerToViewerEvent,
  WSServerToProducerEvent,
  WSProducerEvent,
} from "@claude-chat/shared";
import { WS_HEARTBEAT_TIMEOUT } from "@claude-chat/shared";

interface ProducerConnection {
  ws: any; // Hono WSContext
  userId: string;
  hostname: string;
  cwd: string;
  hitl: boolean;
  connectedAt: string;
  lastHeartbeat: number;
}

interface ViewerConnection {
  ws: any; // Hono WSContext
  userId: string;
}

export class ConnectionManager {
  private producers = new Map<string, ProducerConnection>();
  private viewers = new Map<string, ViewerConnection[]>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Check for stale producers every 15 seconds
    this.heartbeatTimer = setInterval(() => this.checkHeartbeats(), 15_000);
  }

  registerProducer(
    chatId: string,
    ws: any,
    userId: string,
    info: { hostname: string; cwd: string; hitl?: boolean }
  ): boolean {
    if (this.producers.has(chatId)) {
      return false; // Already has a producer
    }

    this.producers.set(chatId, {
      ws,
      userId,
      hostname: info.hostname,
      cwd: info.cwd,
      hitl: info.hitl || false,
      connectedAt: new Date().toISOString(),
      lastHeartbeat: Date.now(),
    });

    this.broadcastToViewers(chatId, {
      type: "producer_status",
      connected: true,
      hostname: info.hostname,
      cwd: info.cwd,
      connectedAt: this.producers.get(chatId)!.connectedAt,
      hitl: info.hitl || false,
    });

    return true;
  }

  removeProducer(chatId: string): void {
    this.producers.delete(chatId);
    this.broadcastToViewers(chatId, {
      type: "producer_status",
      connected: false,
    });
  }

  addViewer(chatId: string, ws: any, userId: string): void {
    const viewers = this.viewers.get(chatId) || [];
    viewers.push({ ws, userId });
    this.viewers.set(chatId, viewers);

    // Send current producer status to the new viewer
    const producer = this.producers.get(chatId);
    const statusEvent: WSServerToViewerEvent = producer
      ? {
          type: "producer_status",
          connected: true,
          hostname: producer.hostname,
          cwd: producer.cwd,
          connectedAt: producer.connectedAt,
          hitl: producer.hitl,
        }
      : { type: "producer_status", connected: false };

    this.safeSend(ws, statusEvent);
  }

  removeViewer(chatId: string, ws: any): void {
    const viewers = this.viewers.get(chatId);
    if (!viewers) return;
    const filtered = viewers.filter((v) => v.ws !== ws);
    if (filtered.length === 0) {
      this.viewers.delete(chatId);
    } else {
      this.viewers.set(chatId, filtered);
    }
  }

  broadcastToViewers(chatId: string, event: WSServerToViewerEvent): void {
    const viewers = this.viewers.get(chatId);
    if (!viewers) return;
    for (const viewer of viewers) {
      this.safeSend(viewer.ws, event);
    }
  }

  sendToProducer(chatId: string, event: WSServerToProducerEvent): boolean {
    const producer = this.producers.get(chatId);
    if (!producer) return false;
    this.safeSend(producer.ws, event);
    return true;
  }

  isProducerConnected(chatId: string): boolean {
    return this.producers.has(chatId);
  }

  getProducerInfo(chatId: string): {
    connected: boolean;
    hostname?: string;
    cwd?: string;
    connectedAt?: string;
    hitl?: boolean;
  } {
    const producer = this.producers.get(chatId);
    if (!producer) return { connected: false };
    return {
      connected: true,
      hostname: producer.hostname,
      cwd: producer.cwd,
      connectedAt: producer.connectedAt,
      hitl: producer.hitl,
    };
  }

  handleProducerHeartbeat(chatId: string): void {
    const producer = this.producers.get(chatId);
    if (producer) {
      producer.lastHeartbeat = Date.now();
    }
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const [chatId, producer] of this.producers) {
      if (now - producer.lastHeartbeat > WS_HEARTBEAT_TIMEOUT) {
        console.log(`Producer heartbeat timeout: chat ${chatId}`);
        try {
          producer.ws.close();
        } catch {
          // ignore close errors
        }
        this.removeProducer(chatId);
      }
    }
  }

  private safeSend(ws: any, event: WSServerToViewerEvent | WSServerToProducerEvent | WSProducerEvent): void {
    try {
      ws.send(JSON.stringify(event));
    } catch {
      // connection may have been closed
    }
  }

  destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    // Close all producer connections
    for (const [chatId, producer] of this.producers) {
      try {
        producer.ws.close();
      } catch {
        // ignore
      }
      this.producers.delete(chatId);
    }
    // Close all viewer connections
    for (const [chatId, viewers] of this.viewers) {
      for (const viewer of viewers) {
        try {
          viewer.ws.close();
        } catch {
          // ignore
        }
      }
      this.viewers.delete(chatId);
    }
  }
}
