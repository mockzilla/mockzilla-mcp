// mock_endpoint round-trip against the real mockzilla CLI: the URL it returns
// must answer, and mocks from the old static/ layout must keep working.
// Skips when no mockzilla CLI is available. Run via `node scripts/mock-endpoint-smoke.mjs`.

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const home = await mkdtemp(path.join(tmpdir(), "mockzilla-mcp-mocks-"));
const legacy = path.join(home, ".cache", "mockzilla-mcp", "mocks", "static", "legacy", "get");
await mkdir(legacy, { recursive: true });
await writeFile(path.join(legacy, "index.json"), JSON.stringify({ from: "static" }));

const bridge = startBridge();
try {
  await bridge.call("initialize", { protocolVersion: "2025-06-18" });
  const cli = parse(await bridge.call("tools/call", { name: "check_cli", arguments: {} }));
  if (!cli.installed) {
    console.log("mock-endpoint-smoke: skipped, no mockzilla CLI on this machine");
    process.exit(0);
  }

  const created = parse(
    await bridge.call("tools/call", {
      name: "mock_endpoint",
      arguments: { path: "/foo/bar", response: { message: "Hallo, Welt" } },
    }),
  );
  check(created.url === `${created.server_url.replace(/\/$/, "")}/foo/bar`, "returned url is the requested path");
  const res = await fetch(created.url);
  check(res.status === 200, `returned url answers 200 (got ${res.status})`);
  check((await res.json()).message === "Hallo, Welt", "returned url serves the response");

  const old = await fetch(`${created.server_url.replace(/\/$/, "")}/legacy`);
  check(old.status === 200, `mock from the old static/ layout still answers (got ${old.status})`);

  const listed = parse(await bridge.call("tools/call", { name: "list_mock_endpoints", arguments: {} }));
  const paths = listed.endpoints.map((e) => e.path).sort();
  check(paths.includes("/foo/bar") && paths.includes("/legacy"), `list shows both mocks (got ${paths.join(", ")})`);

  await bridge.call("tools/call", { name: "clear_mock_endpoints", arguments: {} });
  console.log("mock-endpoint-smoke: ok");
} finally {
  bridge.stop();
}

function startBridge() {
  const child = spawn(process.execPath, ["bin/cli.js"], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, HOME: home, MOCKZILLA_MANAGED_PORT: "0", MOCKZILLA_TOKEN: "" },
  });
  const waiting = new Map();
  let buffer = "";
  let nextId = 1;
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const message = JSON.parse(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
      if (message.id !== undefined) waiting.get(message.id)?.(message);
    }
  });
  return {
    call(method, params) {
      const id = nextId++;
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      return Promise.race([
        new Promise((resolve) => waiting.set(id, resolve)),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), 40_000)),
      ]);
    },
    stop() {
      child.kill();
    },
  };
}

function parse(response) {
  if (response.error) throw new Error(response.error.message);
  if (response.result?.isError) throw new Error(response.result.content[0].text);
  return JSON.parse(response.result.content[0].text);
}

function check(ok, what) {
  if (!ok) {
    console.error(`mock-endpoint-smoke: FAILED: ${what}`);
    process.exitCode = 1;
    throw new Error(what);
  }
}
