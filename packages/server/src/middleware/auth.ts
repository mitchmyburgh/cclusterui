import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";
import { createHash } from "crypto";
import type { ChatRepository } from "@claude-chat/db";
import type { AppEnv } from "../types.js";
import type { ServerConfig } from "../config.js";

export function authMiddleware(config: ServerConfig, repo: ChatRepository) {
  const secretKey = config.jwtSecret
    ? new TextEncoder().encode(config.jwtSecret)
    : null;

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

    if (!token) {
      return c.json(
        { error: "Unauthorized", code: "MISSING_TOKEN", status: 401 },
        401
      );
    }

    // 1. Try JWT decode
    if (secretKey) {
      try {
        const { payload } = await jwtVerify(token, secretKey);
        const userId = payload.userId as string;
        const username = payload.username as string;
        if (userId && username) {
          c.set("apiKey", token);
          c.set("userId", userId);
          c.set("username", username);
          c.set("authType", "jwt");
          await next();
          return;
        }
      } catch {
        // Not a valid JWT, try API key
      }
    }

    // 2. Try API key hash lookup
    if (token.startsWith("cck_")) {
      const keyHash = createHash("sha256").update(token).digest("hex");
      const apiKeyRecord = await repo.getApiKeyByHash(keyHash);
      if (apiKeyRecord) {
        const user = await repo.getUserById(apiKeyRecord.userId);
        if (user) {
          // Update last used asynchronously
          repo.updateApiKeyLastUsed(apiKeyRecord.id).catch(() => {});
          c.set("apiKey", token);
          c.set("userId", user.id);
          c.set("username", user.username);
          c.set("authType", "api_key");
          await next();
          return;
        }
      }
    }

    // 3. Fall back to legacy API_KEYS env
    if (config.apiKeys.includes(token)) {
      c.set("apiKey", token);
      c.set("userId", "system");
      c.set("username", "system");
      c.set("authType", "legacy");
      await next();
      return;
    }

    return c.json(
      { error: "Unauthorized", code: "INVALID_TOKEN", status: 401 },
      401
    );
  });
}
