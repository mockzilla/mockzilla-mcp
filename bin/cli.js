#!/usr/bin/env node
// Stdio MCP proxy: reads JSON-RPC frames on stdin, posts each to the
// hosted mockzilla MCP endpoint with the user's bearer token, and writes
// the response back to stdout.
//
// Auth: set MOCKZILLA_TOKEN to an OAuth-issued bearer (mz_oauth_*) or a
// dashboard-created API key (mz_*). The OAuth flow is the supported path
// for end-users; manual keys are an escape hatch.
//
// Endpoint: defaults to https://app.mockzilla.org/mcp/. Override with
// MOCKZILLA_MCP_URL for staging or self-hosted.

import { createInterface } from "node:readline";

const ENDPOINT = process.env.MOCKZILLA_MCP_URL || "https://app.mockzilla.org/mcp/";
const TOKEN = process.env.MOCKZILLA_TOKEN;

if (!TOKEN) {
  process.stderr.write(
    "MOCKZILLA_TOKEN is not set. Run `npx mockzilla-mcp` with the env var set,\n" +
      "or add it to your MCP client config under `env`.\n",
  );
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", async (raw) => {
  const line = raw.trim();
  if (!line) return;

  let payload;
  try {
    payload = JSON.parse(line);
  } catch (err) {
    writeError(null, -32700, `Parse error: ${err.message}`);
    return;
  }

  try {
    const response = await postToServer(payload);
    if (response !== null) {
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch (err) {
    writeError(payload?.id ?? null, -32603, `Transport error: ${err.message}`);
  }
});

rl.on("close", () => process.exit(0));

async function postToServer(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

function writeError(id, code, message) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n",
  );
}
