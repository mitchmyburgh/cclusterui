import { createRepository, type ChatRepository } from "@ccluster/db";
import { ConnectionManager } from "./connection-manager.js";
import type { ServerConfig } from "./config.js";

export interface AppContext {
  repo: ChatRepository;
  connectionManager: ConnectionManager;
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

  const connectionManager = new ConnectionManager();

  return { repo, connectionManager, config };
}
