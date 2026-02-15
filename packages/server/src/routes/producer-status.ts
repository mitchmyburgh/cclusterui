import { Hono } from "hono";
import type { AppEnv } from "../types.js";

export const producerStatus = new Hono<AppEnv>();

producerStatus.get("/chats/:id/producer-status", async (c) => {
  const chatId = c.req.param("id");
  const userId = c.get("userId");
  const repo = c.get("repo");
  const connectionManager = c.get("connectionManager");

  // Verify chat ownership
  const chat = await repo.getChat(chatId, userId);
  if (!chat) {
    return c.json({ error: "Chat not found", code: "NOT_FOUND", status: 404 }, 404);
  }

  const info = connectionManager.getProducerInfo(chatId);
  return c.json(info);
});
