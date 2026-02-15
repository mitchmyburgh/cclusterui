import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { createAppContext } from "./context.js";
import { mkdirSync } from "fs";
import { dirname } from "path";

async function main() {
  const config = loadConfig();

  // Ensure SQLite data directory exists
  if (config.db.driver === "sqlite" && config.db.sqlitePath) {
    mkdirSync(dirname(config.db.sqlitePath), { recursive: true });
  }

  const context = await createAppContext(config);

  // Create WebSocket support — the Hono app passed to createNodeWebSocket
  // must be the same instance used by serve() so WS upgrades work correctly.
  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  // Mount the full application (REST + WS) onto this app
  const mainApp = createApp(context, upgradeWebSocket);
  app.route("/", mainApp);

  const server = serve(
    {
      fetch: app.fetch,
      port: config.port,
      hostname: config.host,
    },
    (info) => {
      console.log(`Server running at http://${info.address}:${info.port}`);
    }
  );

  injectWebSocket(server);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    context.connectionManager.destroy();
    server.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
