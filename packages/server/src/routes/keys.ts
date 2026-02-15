import { Hono } from "hono";
import { randomBytes, createHash } from "crypto";
import type { AppEnv } from "../types.js";

const keys = new Hono<AppEnv>();

// POST /keys - create API key
keys.post("/keys", async (c) => {
  const repo = c.get("repo");
  const userId = c.get("userId");

  const body = await c.req.json<{ name?: string }>().catch(() => ({ name: undefined }));
  const name = body.name || "Default";

  // Generate raw key: cck_ + 32 hex chars
  const rawKey = "cck_" + randomBytes(16).toString("hex");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  const apiKey = await repo.createApiKey(userId, keyHash, keyPrefix, name);

  return c.json({
    data: {
      apiKey,
      rawKey,
    },
  }, 201);
});

// GET /keys - list API keys
keys.get("/keys", async (c) => {
  const repo = c.get("repo");
  const userId = c.get("userId");

  const apiKeys = await repo.listApiKeys(userId);

  return c.json({ data: apiKeys });
});

// DELETE /keys/:id - revoke API key
keys.delete("/keys/:id", async (c) => {
  const repo = c.get("repo");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const revoked = await repo.revokeApiKey(id, userId);
  if (!revoked) {
    return c.json(
      { error: "API key not found", code: "NOT_FOUND", status: 404 },
      404
    );
  }

  return c.body(null, 204);
});

export { keys };
