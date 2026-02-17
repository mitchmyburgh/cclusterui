import { Hono } from "hono";
import { hash, compare } from "bcryptjs";
import { SignJWT } from "jose";
import type { AppEnv } from "../types.js";

const auth = new Hono<AppEnv>();

// Simple in-memory rate limiter (H2)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function getClientIp(c: any): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

// POST /auth/register
auth.post("/auth/register", async (c) => {
  const repo = c.get("repo");
  const config = c.get("config");

  const ip = getClientIp(c);
  if (isRateLimited(`register:${ip}`)) {
    return c.json(
      {
        error: "Too many requests. Try again later.",
        code: "RATE_LIMITED",
        status: 429,
      },
      429,
    );
  }

  if (!config.jwtSecret) {
    return c.json(
      { error: "JWT not configured", code: "JWT_NOT_CONFIGURED", status: 500 },
      500,
    );
  }

  const body = await c.req.json<{ username?: string; password?: string }>();

  if (!body.username || !body.password) {
    return c.json(
      {
        error: "Username and password are required",
        code: "INVALID_INPUT",
        status: 400,
      },
      400,
    );
  }

  // Check if registration is allowed
  if (config.allowedUsernames.length === 0) {
    return c.json(
      {
        error: "Registration is disabled",
        code: "REGISTRATION_DISABLED",
        status: 403,
      },
      403,
    );
  }

  // Use a generic error for both "not allowed" and "already taken" to prevent user enumeration (L3)
  if (!config.allowedUsernames.includes(body.username)) {
    return c.json(
      {
        error: "Registration failed",
        code: "REGISTRATION_FAILED",
        status: 403,
      },
      403,
    );
  }

  const existing = await repo.getUserByUsername(body.username);
  if (existing) {
    return c.json(
      {
        error: "Registration failed",
        code: "REGISTRATION_FAILED",
        status: 403,
      },
      403,
    );
  }

  const passwordHash = await hash(body.password, 10);
  const user = await repo.createUser(body.username, passwordHash);

  const secretKey = new TextEncoder().encode(config.jwtSecret);
  const token = await new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);

  return c.json(
    {
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    },
    201,
  );
});

// POST /auth/login
auth.post("/auth/login", async (c) => {
  const repo = c.get("repo");
  const config = c.get("config");

  const ip = getClientIp(c);
  if (isRateLimited(`login:${ip}`)) {
    return c.json(
      {
        error: "Too many requests. Try again later.",
        code: "RATE_LIMITED",
        status: 429,
      },
      429,
    );
  }

  if (!config.jwtSecret) {
    return c.json(
      { error: "JWT not configured", code: "JWT_NOT_CONFIGURED", status: 500 },
      500,
    );
  }

  const body = await c.req.json<{ username?: string; password?: string }>();

  if (!body.username || !body.password) {
    return c.json(
      {
        error: "Username and password are required",
        code: "INVALID_INPUT",
        status: 400,
      },
      400,
    );
  }

  const user = await repo.getUserByUsername(body.username);
  if (!user) {
    return c.json(
      {
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
        status: 401,
      },
      401,
    );
  }

  const valid = await compare(body.password, user.passwordHash);
  if (!valid) {
    return c.json(
      {
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
        status: 401,
      },
      401,
    );
  }

  const secretKey = new TextEncoder().encode(config.jwtSecret);
  const token = await new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
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
