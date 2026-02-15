import type { ChatRepository } from "@claude-chat/db";
import type { ClientManager } from "@claude-chat/client";
import type { ServerConfig } from "./config.js";

export type AppEnv = {
  Variables: {
    apiKey: string;
    repo: ChatRepository;
    clientManager: ClientManager;
    config: ServerConfig;
  };
};
