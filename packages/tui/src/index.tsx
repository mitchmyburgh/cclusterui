#!/usr/bin/env node
import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { App } from "./App.js";

const program = new Command()
  .name("claude-chat")
  .description("Terminal UI for CCluster")
  .option(
    "-s, --server <url>",
    "Server URL",
    process.env["CLAUDE_CHAT_SERVER"] || "http://localhost:3000",
  )
  .option(
    "-k, --api-key <key>",
    "API key for authentication",
    process.env["CLAUDE_CHAT_API_KEY"],
  )
  .option("-u, --username <username>", "Username for login")
  .option("-p, --password <password>", "Password for login")
  .parse(process.argv);

const opts = program.opts<{
  server: string;
  apiKey?: string;
  username?: string;
  password?: string;
}>();

async function main() {
  let apiKey = opts.apiKey;

  // If username/password provided, login to get a JWT
  if (!apiKey && opts.username && opts.password) {
    try {
      const res = await fetch(`${opts.server}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: opts.username,
          password: opts.password,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(
          `Login failed: ${(body as { error?: string }).error || `HTTP ${res.status}`}`,
        );
        process.exit(1);
      }

      const body = (await res.json()) as {
        data: { token: string; user: { username: string } };
      };
      apiKey = body.data.token;
      console.log(`Logged in as ${body.data.user.username}`);
    } catch (e) {
      console.error(
        `Login failed: ${e instanceof Error ? e.message : "Network error"}`,
      );
      process.exit(1);
    }
  }

  if (!apiKey) {
    console.error(
      "Error: Authentication required. Use --api-key, CLAUDE_CHAT_API_KEY, or --username/--password.",
    );
    process.exit(1);
  }

  render(<App serverUrl={opts.server} apiKey={apiKey} />);
}

main();
