// Sanity-check that bin/cli.js comes up and answers an MCP `initialize`
// over JSON-RPC on stdio. Run via `node scripts/smoke.mjs`.

import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["bin/cli.js"], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, MOCKZILLA_TOKEN: "" },
});

let buffer = "";
const firstResponse = new Promise((resolve, reject) => {
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const nl = buffer.indexOf("\n");
    if (nl === -1) return;
    try {
      resolve(JSON.parse(buffer.slice(0, nl)));
    } catch (err) {
      reject(err);
    }
  });
  child.once("error", reject);
  child.once("exit", (code, signal) =>
    reject(new Error(`child exited early (code=${code} signal=${signal})`)),
  );
  setTimeout(() => reject(new Error("smoke: timed out after 5s")), 5000);
});

// Pick a protocol version the server is known to speak; the server
// echoes it back when supported, so this also validates the echo path.
const PROTOCOL_VERSION = "2024-11-05";

child.stdin.write(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION },
  }) + "\n",
);

let response;
try {
  response = await firstResponse;
} finally {
  if (!child.killed) child.kill("SIGTERM");
}

if (response?.result?.protocolVersion !== PROTOCOL_VERSION) {
  console.error("smoke: unexpected response:", JSON.stringify(response));
  process.exit(1);
}

if (response?.result?.serverInfo?.name !== "mockzilla-bridge") {
  console.error("smoke: missing serverInfo.name:", JSON.stringify(response));
  process.exit(1);
}

console.log("smoke: ok");
