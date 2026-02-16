#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "path";
import { LocalClient } from "./local-client.js";

const program = new Command();

program
  .name("claude-chat-client")
  .description("Local client that runs Claude Agent SDK against your codebase")
  .requiredOption("--server <url>", "Server URL (e.g., http://localhost:3000)")
  .option("--chat <id>", "Chat ID to connect to (omit to create a new chat)")
  .option("--api-key <key>", "API key or JWT token for authentication")
  .option("--username <username>", "Login with username (requires --password)")
  .option("--password <password>", "Login with password (requires --username)")
  .option("--anthropic-key <key>", "Anthropic API key (defaults to ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN from env)")
  .option("--cwd <path>", "Working directory for Claude operations", ".")
  .option("--hitl", "Enable human-in-the-loop approval for write/exec tools")
  .parse(process.argv);

const opts = program.opts();

async function main() {
  let apiKey = opts.apiKey;

  // Login if username/password provided
  if (opts.username && opts.password && !apiKey) {
    console.log(`Logging in as ${opts.username}...`);
    const res = await fetch(`${opts.server}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: opts.username, password: opts.password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("Login failed:", (body as any).error || res.statusText);
      process.exit(1);
    }

    const data = (await res.json()) as { data: { token: string } };
    apiKey = data.data.token;
    console.log("Login successful");
  }

  if (!apiKey) {
    console.error("Error: --api-key or --username/--password required");
    process.exit(1);
  }

  const cwd = resolve(opts.cwd);
  if (opts.chat) {
    console.log(`Starting local client for chat ${opts.chat}`);
  } else {
    console.log("Starting local client (will create a new chat)");
  }
  console.log(`Working directory: ${cwd}`);
  console.log(`Server: ${opts.server}`);

  const client = new LocalClient({
    serverUrl: opts.server,
    chatId: opts.chat,
    apiKey,
    anthropicApiKey: opts.anthropicKey,
    cwd,
    humanInTheLoop: !!opts.hitl,
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down...");
    client.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  try {
    await client.connect();
    console.log(`Chat ID: ${client.chatId}`);
  } catch (err: any) {
    console.error("Failed to connect:", err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
