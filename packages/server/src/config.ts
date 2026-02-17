import "dotenv/config";

export interface ServerConfig {
  port: number;
  host: string;
  apiKeys: string[];
  jwtSecret: string;
  allowedUsernames: string[];
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
  const jwtSecret = process.env.JWT_SECRET || "";
  const apiKeys = (process.env.API_KEYS || "").split(",").filter(Boolean);

  if (!jwtSecret && apiKeys.length === 0) {
    throw new Error(
      "FATAL: No authentication configured. Set JWT_SECRET and/or API_KEYS environment variable(s).",
    );
  }

  if (!jwtSecret) {
    console.warn("WARNING: JWT_SECRET not set. JWT auth will be disabled.");
  }

  return {
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "0.0.0.0",
    apiKeys,
    jwtSecret,
    allowedUsernames: (process.env.ALLOWED_USERNAMES || "")
      .split(",")
      .filter(Boolean),
    db: {
      driver:
        (process.env.DB_DRIVER as ServerConfig["db"]["driver"]) || "sqlite",
      sqlitePath: process.env.SQLITE_PATH || "./data/claude-chat.db",
      postgresUrl: process.env.POSTGRES_URL,
      mysqlUrl: process.env.MYSQL_URL,
      mongodbUrl: process.env.MONGODB_URL,
      mongodbName: process.env.MONGODB_NAME,
    },
  };
}
