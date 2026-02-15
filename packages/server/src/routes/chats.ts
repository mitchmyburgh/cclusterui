import { Hono } from "hono";
import type { AppEnv } from "../types.js";

const chats = new Hono<AppEnv>();

// GET /chats - list chats
chats.get("/chats", async (c) => {
  const repo = c.get("repo");
  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;
  const result = await repo.listChats({ limit, offset });
  return c.json({ data: result.chats, total: result.total });
});

// POST /chats - create chat
chats.post("/chats", async (c) => {
  const repo = c.get("repo");
  const body = await c.req.json().catch(() => ({}));
  const chat = await repo.createChat(body);
  return c.json({ data: chat }, 201);
});

// GET /chats/:id - get chat
chats.get("/chats/:id", async (c) => {
  const repo = c.get("repo");
  const chat = await repo.getChat(c.req.param("id"));
  if (!chat) return c.json({ error: "Chat not found", code: "NOT_FOUND", status: 404 }, 404);
  return c.json({ data: chat });
});

// PATCH /chats/:id - update chat
chats.patch("/chats/:id", async (c) => {
  const repo = c.get("repo");
  const body = await c.req.json();
  const chat = await repo.updateChat(c.req.param("id"), body);
  if (!chat) return c.json({ error: "Chat not found", code: "NOT_FOUND", status: 404 }, 404);
  return c.json({ data: chat });
});

// DELETE /chats/:id - delete chat
chats.delete("/chats/:id", async (c) => {
  const repo = c.get("repo");
  const deleted = await repo.deleteChat(c.req.param("id"));
  if (!deleted) return c.json({ error: "Chat not found", code: "NOT_FOUND", status: 404 }, 404);
  return c.body(null, 204);
});

export { chats };
