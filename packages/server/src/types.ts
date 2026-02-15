import type { ChatRepository } from "@claude-chat/db";
import type { ConnectionManager } from "./connection-manager.js";
import type { ServerConfig } from "./config.js";

export type AppEnv = {
  Variables: {
    apiKey: string;
    userId: string;
    username: string;
    authType: "jwt" | "api_key" | "legacy";
    repo: ChatRepository;
    connectionManager: ConnectionManager;
    config: ServerConfig;
  };
};
