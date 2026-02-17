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
  .option("--api-key <key>", "API key or JWT token (prefer CC_API_KEY env var)")
  .option("--username <username>", "Login with username (requires --password)")
  .option(
    "--password <password>",
    "Login with password (prefer CC_PASSWORD env var)",
  )
  .option(
    "--anthropic-key <key>",
    "Anthropic API key (prefer ANTHROPIC_API_KEY env var)",
  )
  .option("--cwd <path>", "Working directory for Claude operations", ".")
  .option(
    "--hitl",
    "Enable human-in-the-loop approval (deprecated, use --mode human_confirm)",
  )
  .option(
    "--mode <mode>",
    "Agent mode: plan, human_confirm, or accept_all",
    "accept_all",
  )
  .option(
    "--name <name>",
    "Set the chat title (only used when creating a new chat)",
  )
  .parse(process.argv);

const opts = program.opts();

async function main() {
  // Prefer env vars over CLI args for secrets (H6)
  let apiKey = process.env.CC_API_KEY || opts.apiKey;
  const password = process.env.CC_PASSWORD || opts.password;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || opts.anthropicKey;

  if (opts.apiKey || opts.password) {
    console.warn(
      "WARNING: Passing secrets via CLI flags exposes them in process listings.",
    );
    console.warn(
      "Prefer environment variables: CC_API_KEY, CC_PASSWORD, ANTHROPIC_API_KEY",
    );
  }

  // Warn about HTTP (M12)
  if (
    opts.server?.startsWith("http://") &&
    !opts.server.includes("localhost") &&
    !opts.server.includes("127.0.0.1")
  ) {
    console.warn(
      "WARNING: Using unencrypted HTTP connection. Credentials may be transmitted in cleartext.",
    );
  }

  // Login if username/password provided
  if (opts.username && password && !apiKey) {
    console.log(`Logging in as ${opts.username}...`);
    const res = await fetch(`${opts.server}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: opts.username, password }),
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

  // Resolve mode: --hitl is a deprecated alias for --mode human_confirm
  let agentMode = opts.mode;
  if (opts.hitl && agentMode === "accept_all") {
    agentMode = "human_confirm";
  }
  const validModes = ["plan", "human_confirm", "accept_all"];
  if (!validModes.includes(agentMode)) {
    console.error(
      `Error: Invalid mode "${agentMode}". Must be one of: ${validModes.join(", ")}`,
    );
    process.exit(1);
  }

  if (opts.chat) {
    console.log(`Starting local client for chat ${opts.chat}`);
  } else {
    console.log("Starting local client (will create a new chat)");
  }
  console.log(`Working directory: ${cwd}`);
  console.log(`Server: ${opts.server}`);
  console.log(`Mode: ${agentMode}`);

  const client = new LocalClient({
    serverUrl: opts.server,
    chatId: opts.chat,
    apiKey,
    anthropicApiKey: anthropicKey,
    cwd,
    humanInTheLoop: agentMode === "human_confirm",
    mode: agentMode as "plan" | "human_confirm" | "accept_all",
    chatName: opts.name,
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
