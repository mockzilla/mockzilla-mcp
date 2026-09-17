// Regression cover for four bugs where a tool answered the agent with
// something the server did not do. Each check below failed before the
// fix. Skips when no mockzilla CLI is available.
// Run via `node scripts/behavior-smoke.mjs`.

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { briefError, versionAtLeast } from "../lib/util.js";

check(briefError("x".repeat(310_000)).length < 500, "briefError caps a huge stderr dump");
check(briefError("short") === "short", "briefError leaves a short message alone");
check(versionAtLeast("2.8.16", "2.8.17") === false, "an old CLI is caught");
check(versionAtLeast("2.8.17", "2.8.17") === true, "the fixed CLI passes");
check(versionAtLeast("dev", "2.8.17") === true, "a dev build is not blocked");

const home = await mkdtemp(path.join(tmpdir(), "mockzilla-mcp-behavior-"));

const SPEC = `openapi: 3.0.0
info: {title: Widgets, version: 1.0.0}
paths:
  /widgets:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties: {id: {type: integer}, name: {type: string}}
  /widgets/{id}:
    get:
      parameters:
        - {name: id, in: path, required: true, schema: {type: integer}}
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties: {id: {type: integer}, name: {type: string}}
`;

const specDir = path.join(home, "specs");
await mkdir(specDir, { recursive: true });
const specPath = path.join(specDir, "widgets.yml");
await writeFile(specPath, SPEC);

// A tree whose specs live one level down, like specs/3.0/misc.
const nested = path.join(home, "tree");
await mkdir(path.join(nested, "vendor-a"), { recursive: true });
await writeFile(path.join(nested, "vendor-a", "widgets.yml"), SPEC);

// More specs than discover_specs will summarise.
const many = path.join(home, "many");
await mkdir(many, { recursive: true });
for (let i = 0; i < 60; i++) {
  await writeFile(path.join(many, `api-${i}.yml`), SPEC);
}
// A spec the CLI rejects. One real-world case printed 310KB of
// model-build detail, which alone blew the agent's context.
await writeFile(
  path.join(many, "aaa-broken.yml"),
  `openapi: 3.0.0\ninfo: {title: Broken, version: 1.0.0}\npaths:\n  /x:\n    get:\n      responses:\n        "200":\n          description: ok\n          content:\n            application/json:\n              schema:\n                $ref: "#/components/schemas/Nope"\n`,
);

const bridge = startBridge();
try {
  await bridge.call("initialize", { protocolVersion: "2025-06-18" });
  const cli = parse(await bridge.call("tools/call", { name: "check_cli", arguments: {} }));
  if (!cli.installed) {
    console.log("behavior-smoke: skipped, no mockzilla CLI on this machine");
    process.exit(0);
  }

  // mock_endpoint used to report a status it never served. It now
  // writes meta.json, so the status and headers must reach the wire.
  const failing = await bridge.call("tools/call", {
    name: "mock_endpoint",
    arguments: {
      path: "/orders/999",
      status: 404,
      response: { error: "not_found" },
      headers: { "X-Request-Id": "abc123" },
    },
  });
  if (failing.result?.isError) {
    const text = failing.result.content[0].text;
    check(/2\.8\.20/.test(text), `status refusal names the version it needs (got: ${text.slice(0, 120)})`);
    console.log("behavior-smoke: meta.json guard fired (CLI predates the fix)");
  } else {
    const made = parse(failing);
    check(made.status === 404, `reports the status it wrote (got ${made.status})`);
    const res = await fetch(made.url);
    check(res.status === 404, `mocked 404 answers 404 (got ${res.status})`);
    check((await res.json()).error === "not_found", "the body survives a non-200 status");
    check(res.headers.get("x-request-id") === "abc123", "a custom header reaches the wire");

    // meta.json with no index.<ext>: a response with no body.
    const empty = parse(
      await bridge.call("tools/call", {
        name: "mock_endpoint",
        arguments: { method: "DELETE", path: "/orders/5", status: 204 },
      }),
    );
    check(empty.file_path === null, "a body-less mock writes no index file");
    const gone = await fetch(empty.url, { method: "DELETE" });
    check(gone.status === 204, `body-less mock answers 204 (got ${gone.status})`);
    check((await gone.text()) === "", "204 carries no body");

    const listed = parse(
      await bridge.call("tools/call", { name: "list_mock_endpoints", arguments: {} }),
    );
    const del = listed.endpoints.find((e) => e.method === "DELETE");
    check(!!del, "a meta-only endpoint is listed at all");
    check(del.status === 204, `listing reports its status (got ${del?.status})`);
    const notFound = listed.endpoints.find((e) => e.path === "/orders/999");
    check(notFound?.status === 404, `listing reports a 404 mock (got ${notFound?.status})`);
    await bridge.call("tools/call", { name: "clear_mock_endpoints", arguments: {} });
  }

  const ok = parse(
    await bridge.call("tools/call", {
      name: "mock_endpoint",
      arguments: { path: "/orders/1", response: { id: 1 } },
    }),
  );
  check(ok.status === 200, `mock_endpoint reports the status it serves (got ${ok.status})`);
  const served = await fetch(ok.url);
  check(served.status === 200, `mocked endpoint answers 200 (got ${served.status})`);
  await bridge.call("tools/call", { name: "clear_mock_endpoints", arguments: {} });

  // Bug 4: serve_locally left the agent guessing paths, so it 404'd.
  const up = parse(
    await bridge.call("tools/call", {
      name: "serve_locally",
      arguments: { input: specPath },
    }),
  );
  check(Array.isArray(up.example_endpoints), "serve_locally returns example_endpoints");
  check(up.endpoint_count === 2, `endpoint_count counts the spec (got ${up.endpoint_count})`);
  const sample = up.example_endpoints.find((e) => !e.url.includes("{"));
  check(!!sample, "at least one example URL has no placeholder");
  const hit = await fetch(sample.url);
  check(hit.status === 200, `example URL actually answers (${sample.url} gave ${hit.status})`);
  await bridge.call("tools/call", { name: "stop_locally", arguments: {} });

  // Bug 2: errors was accepted and silently injected nothing on an old CLI.
  const withErrors = await bridge.call("tools/call", {
    name: "serve_locally",
    arguments: { input: specPath, errors: { p100: 503 } },
  });
  if (withErrors.result?.isError) {
    const text = withErrors.result.content[0].text;
    check(/2\.8\.17/.test(text), `errors refusal names the version it needs (got: ${text.slice(0, 120)})`);
    console.log("behavior-smoke: errors guard fired (CLI predates the fix)");
  } else {
    const live = parse(withErrors);
    const target = live.example_endpoints.find((e) => !e.url.includes("{")).url;
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await fetch(`${target}?cb=${i}`)).status);
    check(
      codes.every((c) => c === 503),
      `p100 errors inject on every request (got ${codes.join(",")})`,
    );
    await bridge.call("tools/call", { name: "stop_locally", arguments: {} });
  }

  // Bug 3: a big directory returned an unreadable payload, uncapped.
  const big = parse(
    await bridge.call("tools/call", { name: "discover_specs", arguments: { dir: many } }),
  );
  check(big.truncated === true, "discover_specs flags truncation");
  check(big.spec_file_count === 61, `reports the true count (got ${big.spec_file_count})`);
  check(big.spec_files.length < 61, `caps the summaries (got ${big.spec_files.length})`);
  const size = JSON.stringify(big).length;
  check(size < 60_000, `payload stays readable (${size} chars)`);
  const longest = Math.max(...big.spec_files.map((f) => (f.error || "").length));
  check(longest <= 500, `a rejected spec's error is truncated (longest ${longest})`);

  // A tree of spec folders used to return an empty, dead-end result.
  const tree = parse(
    await bridge.call("tools/call", { name: "discover_specs", arguments: { dir: nested } }),
  );
  check(tree.spec_files.length === 0, "nested tree has no top-level specs");
  check(/vendor-a/.test(tree.notes || ""), `notes name the subdir to recurse into (got: ${tree.notes})`);

  console.log("behavior-smoke: ok");
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
    console.error(`behavior-smoke: FAILED: ${what}`);
    process.exitCode = 1;
    throw new Error(what);
  }
}
