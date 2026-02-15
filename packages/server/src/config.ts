import "dotenv/config";

export interface ServerConfig {
  port: number;
  host: string;
  apiKeys: string[];
  anthropicApiKey: string;
  db: {
    driver: "sqlite" | "postgres" | "mysql" | "mongodb";
    sqlitePath?: string;
    postgresUrl?: string;
    mysqlUrl?: string;
    mongodbUrl?: string;
    mongodbName?: string;
  };
}

export function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "0.0.0.0",
    apiKeys: (process.env.API_KEYS || "").split(",").filter(Boolean),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    db: {
      driver: (process.env.DB_DRIVER as ServerConfig["db"]["driver"]) || "sqlite",
      sqlitePath: process.env.SQLITE_PATH || "./data/claude-chat.db",
      postgresUrl: process.env.POSTGRES_URL,
      mysqlUrl: process.env.MYSQL_URL,
      mongodbUrl: process.env.MONGODB_URL,
      mongodbName: process.env.MONGODB_NAME,
    },
  };
}
