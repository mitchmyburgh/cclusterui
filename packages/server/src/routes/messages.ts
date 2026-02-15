import { Hono } from "hono";
import type { AppEnv } from "../types.js";

const messages = new Hono<AppEnv>();

// GET /chats/:chatId/messages - list messages
messages.get("/chats/:chatId/messages", async (c) => {
  const repo = c.get("repo");
  const chatId = c.req.param("chatId");
  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;
  const result = await repo.getMessages(chatId, { limit, offset });
  return c.json({ data: result.messages, total: result.total });
});

export { messages };
