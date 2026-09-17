// request_history, diagnose_requests, setup_replay and list_replays
// against the real CLI. Skips when no mockzilla is available.
// Run via `node scripts/history-replay-smoke.mjs`.

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const home = await mkdtemp(path.join(tmpdir(), "mockzilla-mcp-hist-"));

const SPEC = `openapi: 3.0.0
info: {title: Shop, version: 1.0.0}
paths:
  /pets:
    get:
      responses:
        "200": {description: ok, content: {application/json: {schema: {type: object, properties: {id: {type: integer}}}}}}
    post:
      responses:
        "200": {description: ok, content: {application/json: {schema: {type: object, properties: {id: {type: integer}}}}}}
`;

const root = path.join(home, "svc");
await mkdir(path.join(root, "services", "shop"), { recursive: true });
await writeFile(path.join(root, "services", "shop", "openapi.yml"), SPEC);

const bridge = startBridge();
try {
  await bridge.call("initialize", { protocolVersion: "2025-06-18" });
  const cli = parse(await bridge.call("tools/call", { name: "check_cli", arguments: {} }));
  if (!cli.installed) {
    console.log("history-replay-smoke: skipped, no mockzilla CLI on this machine");
    process.exit(0);
  }

  // History lives in the running server, so asking with none up must
  // say so rather than return an empty list.
  const noServer = await bridge.call("tools/call", {
    name: "request_history",
    arguments: {},
  });
  check(noServer.result?.isError === true, "request_history errors with no server running");

  const up = parse(
    await bridge.call("tools/call", { name: "serve_locally", arguments: { input: root } }),
  );
  const base = up.url.replace(/\/$/, "");
  await fetch(`${base}/shop/pets`);
  await fetch(`${base}/shop/pets`, { method: "POST" });
  await fetch(`${base}/shop/does-not-exist`);

  const hist = parse(await bridge.call("tools/call", { name: "request_history", arguments: {} }));
  check(hist.count >= 3, `history records the calls (got ${hist.count})`);
  const first = hist.entries[0];
  check(typeof first.status === "number", "an entry carries its status");
  check("duration_ms" in first, "an entry carries its latency");
  check("from_upstream" in first, "an entry says whether it came from upstream");
  check(!("source" in first), "the list does not claim a precise source it cannot know");

  const failed = parse(
    await bridge.call("tools/call", {
      name: "request_history",
      arguments: { failed_only: true },
    }),
  );
  check(
    failed.entries.length >= 1 && failed.entries.every((e) => e.status >= 400),
    "failed_only returns only failures",
  );

  const detail = parse(
    await bridge.call("tools/call", {
      name: "request_history",
      arguments: { service: first.service, id: first.id },
    }),
  );
  check(Array.isArray(detail.entry.response_headers), "detail carries response headers");
  check("response_body" in detail.entry, "detail carries the response body");

  const diag = parse(
    await bridge.call("tools/call", { name: "diagnose_requests", arguments: {} }),
  );
  check(diag.checked >= 3, `diagnose examines the requests (got ${diag.checked})`);
  check(!!diag.data_origin, "diagnose reports where the data came from");
  check(diag.latency_ms !== null, "diagnose reports latency");
  check(
    diag.findings.some((f) => f.kind === "not_found"),
    `diagnose flags the 404 (kinds: ${diag.findings.map((f) => f.kind).join(",") || "none"})`,
  );
  // Replayed and cached responses never reach the history middleware.
  // Without saying so, a log of nothing but `mock` reads as "replay is
  // not working" when replay is serving every call.
  check(
    /replay/i.test(diag.not_counted || "") && /cache/i.test(diag.not_counted || ""),
    "diagnose says which responses history cannot see",
  );

  // A folder outside the bridge's mocks dir is the user's: return the
  // YAML, do not edit it.
  const outside = parse(
    await bridge.call("tools/call", {
      name: "setup_replay",
      arguments: {
        service: "shop",
        dir: root,
        endpoints: [{ path: "/pets", method: "POST", match: { body: ["name"] } }],
      },
    }),
  );
  check(outside.written === false, "setup_replay does not write outside its own mocks dir");
  check(/replay:/.test(outside.config_yaml), "it returns the YAML to apply");
  check(/X-Mockzilla-Replay;/.test(outside.how_to_record), "it warns about curl's empty-header form");
  check(
    outside.recording_scope[0].keyed_by.includes("body:name"),
    "it spells out what the recording is keyed by",
  );

  const wide = parse(
    await bridge.call("tools/call", {
      name: "setup_replay",
      arguments: { service: "shop", dir: root, endpoints: [{ path: "/pets" }] },
    }),
  );
  check(
    /ONE recording/.test(wide.recording_scope[0].means),
    "it warns that no match fields means one recording for the endpoint",
  );

  // upstream_only without an upstream makes every request 502.
  const bad = await bridge.call("tools/call", {
    name: "setup_replay",
    arguments: {
      service: "shop",
      dir: root,
      upstream_only: true,
      endpoints: [{ path: "/pets", method: "POST" }],
    },
  });
  check(bad.result?.isError === true, "setup_replay refuses upstream_only with no upstream");
  check(/502/.test(bad.result.content[0].text), "the refusal says what would happen");

  // A top-level-array body field has to be quoted or the YAML breaks.
  const quoted = parse(
    await bridge.call("tools/call", {
      name: "setup_replay",
      arguments: {
        service: "shop",
        dir: root,
        endpoints: [{ path: "/pets", method: "POST", match: { body: ["[0].name"] } }],
      },
    }),
  );
  check(/- "\[0\]\.name"/.test(quoted.config_yaml), "an array-index field is quoted in the YAML");

  await bridge.call("tools/call", { name: "stop_locally", arguments: {} });
  console.log("history-replay-smoke: ok");
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
    console.error(`history-replay-smoke: FAILED: ${what}`);
    process.exitCode = 1;
    throw new Error(what);
  }
}
