#!/usr/bin/env node
// MCP server for mockzilla. Stdio JSON-RPC entry point.
//
// Two planes of tools live behind this entry:
//
// • Local tools (no auth needed): inspect the user's machine, run a
//   portable mock server locally, peek at a spec, install the mockzilla
//   CLI itself if missing. Always available. See lib/tools.js.
//
// • Hosted tools (account-scoped): proxied to the hosted MCP endpoint
//   (`/mcp/`) when MOCKZILLA_TOKEN is set. Without a token, the local
//   plane is the entire surface and the agent can still help the user
//   explore mockzilla before they sign up. See lib/proxy.js.

import { createInterface } from "node:readline";

import { killAllLocal } from "../lib/local.js";
import { hasToken, proxy } from "../lib/proxy.js";
import { LOCAL_TOOLS } from "../lib/tools.js";
import { bridgeVersion, latestPublishedVersion } from "../lib/version.js";

// Protocol versions we know how to speak. Order doesn't matter for
// matching, but the first entry is what we fall back to if the client
// asks for something we don't recognise.
const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
];

// Warm the npm "latest" cache in the background so `bridge_status` is
// instant when the agent calls it. Failure here is silent — the tool
// will retry on demand.
latestPublishedVersion().catch(() => {});

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
    const response = await handle(payload);
    if (response !== null) {
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch (err) {
    writeError(payload?.id ?? null, -32603, `Internal error: ${err.message}`);
  }
});

rl.on("close", () => {
  killAllLocal();
  process.exit(0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    killAllLocal();
    process.exit(0);
  });
}

async function handle(payload) {
  const { id, method, params = {} } = payload ?? {};

  if (method === "initialize") {
    const version = await bridgeVersion();

    // Echo the client's protocol version when we support it; some
    // clients (e.g. Gemini CLI) hard-disconnect on a mismatch even
    // though the MCP spec allows the server to pick its own.
    const requested = params?.protocolVersion;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
      ? requested
      : SUPPORTED_PROTOCOL_VERSIONS[0];
    return reply(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "mockzilla-bridge", version },
    });
  }

  if (method === "notifications/initialized") {
    return null;
  }

  // Standard MCP keepalive. Gemini CLI's connection probe pings on
  // startup and treats a -32601 here as a hard disconnect.
  if (method === "ping") {
    return reply(id, {});
  }

  if (method === "tools/list") {
    const local = Object.entries(LOCAL_TOOLS).map(([name, t]) => ({
      name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    if (!hasToken) {
      return reply(id, { tools: local });
    }
    const upstream = await proxy(payload);
    const hostedTools = upstream?.result?.tools ?? [];
    return reply(id, { tools: [...local, ...hostedTools] });
  }

  if (method === "tools/call") {
    const name = params?.name;
    if (typeof name === "string" && name in LOCAL_TOOLS) {
      const args = params.arguments ?? {};
      try {
        const result = await LOCAL_TOOLS[name].handler(args);
        return reply(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: false,
        });
      } catch (err) {
        return reply(id, {
          content: [{ type: "text", text: `Tool error: ${err.message}` }],
          isError: true,
        });
      }
    }

    if (!hasToken) {
      return reply(id, {
        content: [
          {
            type: "text",
            text:
              `Tool "${name}" needs a mockzilla account. Set ` +
              `MOCKZILLA_TOKEN in your MCP client config to use it.`,
          },
        ],
        isError: true,
      });
    }
    return await proxy(payload);
  }

  if (!hasToken) {
    return errorResponse(id, -32601, `Unknown method: ${method}`);
  }
  return await proxy(payload);
}

function reply(id, result) {
  if (id === undefined || id === null) return null;
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function writeError(id, code, message) {
  process.stdout.write(JSON.stringify(errorResponse(id, code, message)) + "\n");
}
