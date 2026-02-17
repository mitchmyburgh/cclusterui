import { Hono } from "hono";
import { MAX_PAGE_SIZE } from "@mitchmyburgh/shared";
import type { AppEnv } from "../types.js";

const chats = new Hono<AppEnv>();

// GET /chats - list chats
chats.get("/chats", async (c) => {
  const repo = c.get("repo");
  const userId = c.get("userId");
  const limit = Math.min(
    Math.max(Number(c.req.query("limit")) || 50, 1),
    MAX_PAGE_SIZE,
  );
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);
  const result = await repo.listChats(userId, { limit, offset });
  return c.json({ data: result.chats, total: result.total });
});

// POST /chats - create chat
chats.post("/chats", async (c) => {
  const repo = c.get("repo");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));

  // Only allow 'title' field (M7, M10)
  const input: { title?: string } = {};
  if (typeof body.title === "string" && body.title.trim().length > 0) {
    input.title = body.title.trim().substring(0, 200);
  }

  const chat = await repo.createChat(input, userId);
  return c.json({ data: chat }, 201);
});

// GET /chats/:id - get chat
chats.get("/chats/:id", async (c) => {
  const repo = c.get("repo");
  const userId = c.get("userId");
  const chat = await repo.getChat(c.req.param("id"), userId);
  if (!chat)
    return c.json(
      { error: "Chat not found", code: "NOT_FOUND", status: 404 },
      404,
    );
  return c.json({ data: chat });
});

// PATCH /chats/:id - update chat
chats.patch("/chats/:id", async (c) => {
  const repo = c.get("repo");
  const userId = c.get("userId");
  const body = await c.req.json();

  // Only allow 'title' field (M7, M10)
  const input: { title?: string } = {};
  if (typeof body.title === "string" && body.title.trim().length > 0) {
    input.title = body.title.trim().substring(0, 200);
  }

  if (Object.keys(input).length === 0) {
    return c.json(
      {
        error: "No valid fields to update",
        code: "INVALID_INPUT",
        status: 400,
      },
      400,
    );
  }

  const chat = await repo.updateChat(c.req.param("id"), userId, input);
  if (!chat)
    return c.json(
      { error: "Chat not found", code: "NOT_FOUND", status: 404 },
      404,
    );
  return c.json({ data: chat });
});

// DELETE /chats/:id - delete chat
chats.delete("/chats/:id", async (c) => {
  const repo = c.get("repo");
  const userId = c.get("userId");
  const deleted = await repo.deleteChat(c.req.param("id"), userId);
  if (!deleted)
    return c.json(
      { error: "Chat not found", code: "NOT_FOUND", status: 404 },
      404,
    );
  return c.body(null, 204);
});

export { chats };
