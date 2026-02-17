import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { serveStatic } from "@hono/node-server/serve-static";
import { authMiddleware } from "./middleware/auth.js";
import { auth } from "./routes/auth.js";
import { chats } from "./routes/chats.js";
import { keys } from "./routes/keys.js";
import { messages } from "./routes/messages.js";
import { createWsRoutes } from "./routes/ws.js";
import { producerStatus } from "./routes/producer-status.js";
import type { AppEnv } from "./types.js";
import type { AppContext } from "./context.js";

export function createApp(context: AppContext, upgradeWebSocket?: any) {
  const app = new Hono<AppEnv>();

  app.use("*", logger());

  // Security headers (M6)
  app.use(
    "*",
    secureHeaders({
      xFrameOptions: "DENY",
      xContentTypeOptions: "nosniff",
      referrerPolicy: "strict-origin-when-cross-origin",
      ...(process.env.NODE_ENV === "production"
        ? { strictTransportSecurity: "max-age=63072000; includeSubDomains" }
        : {}),
    }),
  );

  // Configurable CORS (M2)
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:5173"];

  app.use(
    "*",
    cors({
      origin: corsOrigins,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    }),
  );

  // Health check (no auth)
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Inject context into all /api routes
  app.use("/api/*", async (c, next) => {
    c.set("repo", context.repo);
    c.set("connectionManager", context.connectionManager);
    c.set("config", context.config);
    await next();
  });

  // Public auth routes (before auth middleware)
  app.route("/api", auth);

  // Auth for all other /api routes
  app.use("/api/*", authMiddleware(context.config, context.repo));

  // Protected routes
  app.route("/api", chats);
  app.route("/api", messages);
  app.route("/api", keys);
  app.route("/api", producerStatus);

  if (upgradeWebSocket) {
    app.route("/api", createWsRoutes(upgradeWebSocket));
  }

  // Serve static files in production
  if (process.env.NODE_ENV === "production") {
    app.use("/*", serveStatic({ root: "./packages/ui/dist" }));
  }

  // Error handler - don't leak internal details (M1)
  app.onError((err, c) => {
    console.error("Server error:", err);
    return c.json(
      { error: "Internal server error", code: "INTERNAL_ERROR", status: 500 },
      500,
    );
  });

  return app;
}
