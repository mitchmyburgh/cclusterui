import type { ChatRepository } from "./repository.js";

export type DbDriver = "sqlite" | "postgres" | "mysql" | "mongodb";

export interface DbConfig {
  driver: DbDriver;
  sqlitePath?: string;
  postgresUrl?: string;
  mysqlUrl?: string;
  mongodbUrl?: string;
  mongodbName?: string;
}

export async function createRepository(config: DbConfig): Promise<ChatRepository> {
  switch (config.driver) {
    case "sqlite": {
      if (!config.sqlitePath) {
        throw new Error("sqlitePath is required for sqlite driver");
      }
      const { SqliteRepository } = await import("./sql/sqlite-repository.js");
      return new SqliteRepository({ path: config.sqlitePath });
    }

    case "postgres": {
      if (!config.postgresUrl) {
        throw new Error("postgresUrl is required for postgres driver");
      }
      const { PgRepository } = await import("./sql/pg-repository.js");
      const repo = new PgRepository({ connectionString: config.postgresUrl });
      await repo.init();
      return repo;
    }

    case "mysql": {
      if (!config.mysqlUrl) {
        throw new Error("mysqlUrl is required for mysql driver");
      }
      const { MysqlRepository } = await import("./sql/mysql-repository.js");
      const repo = new MysqlRepository({ connectionString: config.mysqlUrl });
      await repo.init();
      return repo;
    }

    case "mongodb": {
      if (!config.mongodbUrl) {
        throw new Error("mongodbUrl is required for mongodb driver");
      }
      const { MongoRepository } = await import("./mongo/mongo-repository.js");
      const repo = new MongoRepository({
        connectionString: config.mongodbUrl,
        dbName: config.mongodbName,
      });
      await repo.init();
      return repo;
    }

    default:
      throw new Error(`Unsupported database driver: ${config.driver}`);
  }
}
