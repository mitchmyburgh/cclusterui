import { createRepository, type ChatRepository } from "@claude-chat/db";
import { ClientManager } from "@claude-chat/client";
import type { ServerConfig } from "./config.js";

export interface AppContext {
  repo: ChatRepository;
  clientManager: ClientManager;
  config: ServerConfig;
}

export async function createAppContext(config: ServerConfig): Promise<AppContext> {
  const repo = await createRepository({
    driver: config.db.driver,
    sqlitePath: config.db.sqlitePath,
    postgresUrl: config.db.postgresUrl,
    mysqlUrl: config.db.mysqlUrl,
    mongodbUrl: config.db.mongodbUrl,
    mongodbName: config.db.mongodbName,
  });

  const clientManager = new ClientManager({
    anthropicApiKey: config.anthropicApiKey,
    cwd: process.cwd(),
  });

  return { repo, clientManager, config };
}
