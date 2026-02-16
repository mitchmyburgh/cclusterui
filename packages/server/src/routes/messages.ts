import { Hono } from "hono";
import { MAX_PAGE_SIZE } from "@mitchmyburgh/shared";
import type { AppEnv } from "../types.js";

const messages = new Hono<AppEnv>();

// GET /chats/:chatId/messages - list messages
messages.get("/chats/:chatId/messages", async (c) => {
  const repo = c.get("repo");
  const userId = c.get("userId");
  const chatId = c.req.param("chatId");

  // Verify chat ownership
  const chat = await repo.getChat(chatId, userId);
  if (!chat) {
    return c.json({ error: "Chat not found", code: "NOT_FOUND", status: 404 }, 404);
  }

  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 50, 1), MAX_PAGE_SIZE);
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);
  const result = await repo.getMessages(chatId, { limit, offset });
  return c.json({ data: result.messages, total: result.total });
});

export { messages };
