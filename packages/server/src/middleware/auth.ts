import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types.js";

export function authMiddleware(apiKeys: string[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    let token: string | undefined;

    // Check Authorization header
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    // Fallback to query param (for WebSocket connections)
    if (!token) {
      token = c.req.query("token");
    }

    // Validate token
    if (!token || !apiKeys.includes(token)) {
      return c.json(
        {
          error: "Unauthorized",
          code: "INVALID_API_KEY",
          status: 401,
        },
        401
      );
    }

    // Store valid token in context
    c.set("apiKey", token);
    await next();
  });
}
