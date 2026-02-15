import { Hono } from "hono";
import { hash, compare } from "bcryptjs";
import { SignJWT } from "jose";
import type { AppEnv } from "../types.js";

const auth = new Hono<AppEnv>();

// POST /auth/register
auth.post("/auth/register", async (c) => {
  const repo = c.get("repo");
  const config = c.get("config");

  if (!config.jwtSecret) {
    return c.json(
      { error: "JWT not configured", code: "JWT_NOT_CONFIGURED", status: 500 },
      500
    );
  }

  const body = await c.req.json<{ username?: string; password?: string }>();

  if (!body.username || !body.password) {
    return c.json(
      { error: "Username and password are required", code: "INVALID_INPUT", status: 400 },
      400
    );
  }

  // Check if registration is allowed
  if (config.allowedUsernames.length === 0) {
    return c.json(
      { error: "Registration is disabled", code: "REGISTRATION_DISABLED", status: 403 },
      403
    );
  }

  if (!config.allowedUsernames.includes(body.username)) {
    return c.json(
      { error: "Username not allowed to register", code: "USERNAME_NOT_ALLOWED", status: 403 },
      403
    );
  }

  // Check if username exists
  const existing = await repo.getUserByUsername(body.username);
  if (existing) {
    return c.json(
      { error: "Username already taken", code: "USERNAME_TAKEN", status: 409 },
      409
    );
  }

  const passwordHash = await hash(body.password, 10);
  const user = await repo.createUser(body.username, passwordHash);

  const secretKey = new TextEncoder().encode(config.jwtSecret);
  const token = await new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey);

  return c.json({
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    },
  }, 201);
});

// POST /auth/login
auth.post("/auth/login", async (c) => {
  const repo = c.get("repo");
  const config = c.get("config");

  if (!config.jwtSecret) {
    return c.json(
      { error: "JWT not configured", code: "JWT_NOT_CONFIGURED", status: 500 },
      500
    );
  }

  const body = await c.req.json<{ username?: string; password?: string }>();

  if (!body.username || !body.password) {
    return c.json(
      { error: "Username and password are required", code: "INVALID_INPUT", status: 400 },
      400
    );
  }

  const user = await repo.getUserByUsername(body.username);
  if (!user) {
    return c.json(
      { error: "Invalid credentials", code: "INVALID_CREDENTIALS", status: 401 },
      401
    );
  }

  const valid = await compare(body.password, user.passwordHash);
  if (!valid) {
    return c.json(
      { error: "Invalid credentials", code: "INVALID_CREDENTIALS", status: 401 },
      401
    );
  }

  const secretKey = new TextEncoder().encode(config.jwtSecret);
  const token = await new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey);

  return c.json({
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    },
  });
});

export { auth };
