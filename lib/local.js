// Local plane: tools that touch this machine. Spawn portable mockzilla
// servers, stop them, mock single endpoints into a managed static dir,
// peek at OpenAPI specs, and call HTTP URLs.

import { exec as execCb, spawn } from "node:child_process";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { resolveMockzilla } from "./install.js";
import { shellEscape } from "./util.js";

const exec = promisify(execCb);

const READY_TIMEOUT_MS = 30_000;

// Where mock_endpoint persists static endpoints. The whole tree under
// MOCKS_ROOT is owned by the bridge; users can blow it away with
// `rm -rf ~/.cache/mockzilla-mcp/mocks` to reset.
const MOCKS_ROOT = path.join(homedir(), ".cache", "mockzilla-mcp", "mocks");
const MOCKS_STATIC_DIR = path.join(MOCKS_ROOT, "static");

const ALLOWED_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

// In-flight portable processes keyed by PID. Entries carry a `kind`
// tag — "adhoc" (started via serve_locally with user-supplied input)
// or "managed" (started by mock_endpoint, points at MOCKS_ROOT). The
// two are mutually exclusive: only one server runs at a time, and
// each tool refuses if the wrong kind is up.
const localServers = new Map();
let starting = false;

// Sticky port for the managed (mock_endpoint) server. mockzilla's
// default is 2200; we try that first, then keep whatever port we
// actually got bound across all subsequent restarts in this bridge
// session. Without this, every mock_endpoint call lands on a fresh
// kernel-picked port and the user's terminal curls go stale.
const MANAGED_DEFAULT_PORT = parseInt(
  process.env.MOCKZILLA_MANAGED_PORT || "2200",
  10,
);
let lastManagedPort = null;

export async function serveLocally(args) {
  const inputs = normaliseInputs(args.input);
  if (inputs.length === 0) {
    throw new Error("`input` must be a non-empty string or array of strings");
  }

  refuseIfBusy("adhoc");

  // Prefer the standard mockzilla port so terminal curls are
  // memorable; fall back to OS-picked if it's busy. Agent-supplied
  // port (including 0 for explicit kernel-pick) overrides.
  let port;
  if (Number.isInteger(args.port)) {
    port = args.port;
  } else if (
    Number.isInteger(MANAGED_DEFAULT_PORT) &&
    MANAGED_DEFAULT_PORT > 0 &&
    (await isPortFree(MANAGED_DEFAULT_PORT))
  ) {
    port = MANAGED_DEFAULT_PORT;
  } else {
    port = 0;
  }

  let stamp;
  try {
    stamp = await spawnPortable({ inputs, port, kind: "adhoc" });
  } catch (err) {
    // Port was free at probe time but bind failed (race) — retry on
    // OS-picked. Only retry once, only when we chose the port ourselves.
    if (port === MANAGED_DEFAULT_PORT && !Number.isInteger(args.port)) {
      stamp = await spawnPortable({ inputs, port: 0, kind: "adhoc" });
    } else {
      throw err;
    }
  }
  return {
    pid: stamp.pid,
    port: stamp.port,
    url: stamp.url,
    services: stamp.services,
    via: stamp.via,
    admin: adminUrls(stamp.port),
    stop_with: "Call stop_locally with no arguments to shut this down.",
  };
}

export async function stopLocally() {
  if (localServers.size === 0) {
    return { stopped: false, reason: "No mockzilla server is running." };
  }
  const [pid, entry] = localServers.entries().next().value;
  entry.child.kill("SIGTERM");
  await new Promise((resolve) => entry.child.once("exit", resolve));
  localServers.delete(pid);
  if (entry.kind === "managed") lastManagedPort = null;
  return { stopped: true, pid, kind: entry.kind };
}

export async function mockEndpoint(args) {
  const method = String(args.method || "GET").toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`Unsupported method: ${method}`);
  }
  const rawPath = args.path;
  if (typeof rawPath !== "string" || !rawPath.startsWith("/")) {
    throw new Error("`path` must be a string starting with /");
  }

  const segments = rawPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error("`path` must include at least one segment after /");
  }
  const service = segments[0];
  const subPath = segments.slice(1);

  const status = Number.isInteger(args.status) ? args.status : 200;
  const response =
    args.response !== undefined && args.response !== null ? args.response : {};
  const contentType =
    typeof args.content_type === "string"
      ? args.content_type
      : typeof response === "string"
        ? "text/plain"
        : "application/json";
  const ext = extensionFor(contentType);

  refuseIfBusy("managed");

  // Write the file BEFORE (re)starting the server. Empty MOCKS_ROOT
  // would cause mockzilla to bail with "no specs found"; we want at
  // least the just-written endpoint to be present on first launch.
  const dir = path.join(
    MOCKS_STATIC_DIR,
    service,
    ...subPath,
    method.toLowerCase(),
  );
  const file = path.join(dir, `index.${ext}`);
  await mkdir(dir, { recursive: true });
  const body =
    typeof response === "string"
      ? response
      : JSON.stringify(response, null, 2);
  await writeFile(file, body);

  // Restart-on-write: portable mode does NOT hot-reload new files into
  // the spec set, so we kill the running managed server (if any) and
  // start fresh pointing at MOCKS_ROOT. ~1s round trip.
  await killManaged();
  const stamp = await spawnManagedServer();

  const url = `${stamp.url.replace(/\/$/, "")}/${service}${
    subPath.length > 0 ? "/" + subPath.join("/") : ""
  }`;
  const hasPlaceholder = /\{[^}]+\}/.test(rawPath);

  return {
    method,
    path: rawPath,
    service,
    url,
    status,
    file_path: file,
    server_url: stamp.url,
    admin: adminUrls(stamp.port),
    notes: hasPlaceholder
      ? `Path contains placeholder(s) like {id}; ALL values share this response. ` +
        `For per-value responses, call mock_endpoint with literal values ` +
        `(e.g. ${rawPath.replace(/\{[^}]+\}/g, "123")}).`
      : null,
  };
}

export async function listMockEndpoints() {
  const endpoints = [];
  const rootStat = await stat(MOCKS_STATIC_DIR).catch(() => null);
  if (!rootStat || !rootStat.isDirectory()) {
    return {
      endpoints: [],
      count: 0,
      server_url: managedServerUrl(),
      ui_url: managedServerUiUrl(),
      notes:
        "No mocks have been created yet. Use mock_endpoint to add one.",
    };
  }

  const services = await readdir(MOCKS_STATIC_DIR, { withFileTypes: true });
  for (const svc of services) {
    if (!svc.isDirectory()) continue;
    await collectEndpoints(
      path.join(MOCKS_STATIC_DIR, svc.name),
      svc.name,
      [],
      endpoints,
    );
  }

  const serverUrl = managedServerUrl();
  return {
    endpoints,
    count: endpoints.length,
    server_url: serverUrl,
    ui_url: managedServerUiUrl(),
    notes: serverUrl
      ? `Open ${managedServerUiUrl()} for the mockzilla UI ` +
        `(grouped by service, request inspection, response config).`
      : "No managed server is currently running. The next mock_endpoint " +
        "call will start one.",
  };
}

export async function clearMockEndpoints() {
  // Kill the managed server first so it's not holding file handles
  // when we delete its tree out from under it.
  const wasRunning = await killManaged();
  await rm(MOCKS_ROOT, { recursive: true, force: true });
  lastManagedPort = null;
  return {
    cleared: true,
    server_was_running: wasRunning,
    notes:
      "All mocks deleted. Managed server stopped. Next mock_endpoint " +
      "call will create a fresh server.",
  };
}

async function collectEndpoints(dir, service, pathSegs, out) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const childDir = path.join(dir, e.name);
    if (ALLOWED_METHODS.has(e.name.toUpperCase())) {
      const childEntries = await readdir(childDir, {
        withFileTypes: true,
      }).catch(() => []);
      const idx = childEntries.find(
        (ce) => ce.isFile() && ce.name.startsWith("index."),
      );
      if (idx) {
        out.push({
          method: e.name.toUpperCase(),
          service,
          path: "/" + [service, ...pathSegs].join("/"),
          file: path.join(childDir, idx.name),
        });
      }
    } else {
      await collectEndpoints(childDir, service, [...pathSegs, e.name], out);
    }
  }
}

function managedServerUrl() {
  if (localServers.size === 0) return null;
  const [, entry] = localServers.entries().next().value;
  return entry.kind === "managed" ? entry.url : null;
}

function managedServerUiUrl() {
  const url = managedServerUrl();
  return url ? url.replace(/\/$/, "") + "/" : null;
}

export async function callEndpoint(args) {
  const url = args.url;
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("`url` must be a non-empty string");
  }
  const method = (args.method || "GET").toUpperCase();
  const headers = args.headers && typeof args.headers === "object" ? args.headers : {};
  const body = args.body;

  // Default to localhost-only to keep this tool firmly in the local
  // plane. Users who want to call an arbitrary URL can pass
  // `allow_remote: true`, but we want the agent to think twice — the
  // bridge isn't a general-purpose HTTP client.
  if (!args.allow_remote && !isLocalhost(url)) {
    throw new Error(
      `Refusing to call ${url}: only localhost URLs by default. ` +
        `Pass allow_remote: true to override.`,
    );
  }

  const init = { method, headers };
  if (body !== undefined && body !== null && method !== "GET" && method !== "HEAD") {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
      init.headers = {
        ...headers,
        "Content-Type": typeof body === "string" ? "text/plain" : "application/json",
      };
    }
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  let res;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    throw new Error(`request failed: ${err.message}`);
  } finally {
    clearTimeout(t);
  }

  const text = await res.text();
  const truncated = text.length > 4000;
  const bodyOut = truncated ? `${text.slice(0, 4000)}…` : text;
  let parsed = null;
  if (!truncated) {
    try {
      parsed = JSON.parse(text);
    } catch {
      /* not JSON; bodyOut is the text */
    }
  }

  return {
    status: res.status,
    status_text: res.statusText,
    headers: Object.fromEntries(res.headers),
    body: parsed ?? bodyOut,
    truncated,
  };
}

export async function peekOpenapi(args) {
  return await runInfo(args.input);
}

export async function info(args) {
  return await runInfo(args.input);
}

async function runInfo(input) {
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("`input` must be a non-empty string");
  }
  const resolved = await resolveMockzilla();
  if (!resolved) {
    throw new Error("mockzilla is not installed. Call install_cli first.");
  }
  const [cmd, ...prefix] =
    resolved.type === "binary" ? [resolved.path] : resolved.invocation;
  const cmdline = [cmd, ...prefix, "info", input].map(shellEscape).join(" ");
  try {
    const { stdout } = await exec(cmdline);
    return JSON.parse(stdout);
  } catch (err) {
    throw new Error((err.stderr && err.stderr.trim()) || err.message);
  }
}

// Cache for simplified specs when the caller didn't pass an output
// path. Lives under the bridge's own cache so users can wipe it with
// `rm -rf ~/.cache/mockzilla-mcp/simplified`.
const SIMPLIFIED_DIR = path.join(
  homedir(),
  ".cache",
  "mockzilla-mcp",
  "simplified",
);

export async function simplify(args) {
  const input = args.input;
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("`input` must be a non-empty string (spec path or URL)");
  }
  const resolved = await resolveMockzilla();
  if (!resolved) {
    throw new Error("mockzilla is not installed. Call install_cli first.");
  }

  const cliArgs = ["simplify"];

  // --optional N is mutually exclusive with the --optional-min/-max
  // pair. Reject mixed inputs at the boundary so the CLI doesn't have
  // to.
  const hasOptional = Number.isInteger(args.optional);
  const hasMin = Number.isInteger(args.optional_min);
  const hasMax = Number.isInteger(args.optional_max);
  if (hasOptional && (hasMin || hasMax)) {
    throw new Error(
      "Pass either `optional` OR (`optional_min` + `optional_max`), not both.",
    );
  }
  if (hasMin !== hasMax) {
    throw new Error(
      "`optional_min` and `optional_max` must be supplied together.",
    );
  }
  if (hasOptional) {
    if (args.optional < 0) {
      throw new Error("`optional` must be >= 0");
    }
    cliArgs.push("--optional", String(args.optional));
  } else if (hasMin) {
    if (args.optional_min < 0 || args.optional_max < args.optional_min) {
      throw new Error(
        "`optional_min` must be >= 0 and `optional_max` >= optional_min",
      );
    }
    cliArgs.push("--optional-min", String(args.optional_min));
    cliArgs.push("--optional-max", String(args.optional_max));
  }

  if (typeof args.config === "string" && args.config) {
    cliArgs.push("--config", args.config);
  }

  const output =
    typeof args.output === "string" && args.output
      ? args.output
      : path.join(
          SIMPLIFIED_DIR,
          `${baseName(input)}-${Date.now()}${extFor(input)}`,
        );
  await mkdir(path.dirname(output), { recursive: true });
  cliArgs.push("--output", output, input);

  const [cmd, ...prefix] =
    resolved.type === "binary" ? [resolved.path] : resolved.invocation;
  const cmdline = [cmd, ...prefix, ...cliArgs].map(shellEscape).join(" ");
  try {
    await exec(cmdline);
  } catch (err) {
    throw new Error((err.stderr && err.stderr.trim()) || err.message);
  }
  const s = await stat(output);
  return {
    input,
    output,
    size_bytes: s.size,
    notes:
      "The simplified spec is on disk. Hand `output` to `serve_locally` " +
      "to try it, or to `info` to inspect.",
  };
}

export async function pack(args) {
  const dir = args.dir;
  if (typeof dir !== "string" || dir.length === 0) {
    throw new Error("`dir` must be a non-empty string (directory to pack)");
  }
  const resolved = await resolveMockzilla();
  if (!resolved) {
    throw new Error("mockzilla is not installed. Call install_cli first.");
  }

  const cliArgs = ["pack"];
  if (typeof args.output === "string" && args.output) {
    cliArgs.push("--output", args.output);
  }
  if (typeof args.name === "string" && args.name) {
    cliArgs.push("--name", args.name);
  }
  if (typeof args.description === "string" && args.description) {
    cliArgs.push("--description", args.description);
  }
  if (typeof args.min_version === "string" && args.min_version) {
    cliArgs.push("--min-version", args.min_version);
  }
  if (args.skip_git === true) {
    cliArgs.push("--skip-git");
  }
  cliArgs.push(dir);

  const [cmd, ...prefix] =
    resolved.type === "binary" ? [resolved.path] : resolved.invocation;
  const cmdline = [cmd, ...prefix, ...cliArgs].map(shellEscape).join(" ");
  let stdout;
  try {
    ({ stdout } = await exec(cmdline));
  } catch (err) {
    throw new Error((err.stderr && err.stderr.trim()) || err.message);
  }

  // The CLI prints `Packed <src> -> <out>` on success. Pull the output
  // path back out so the agent has a concrete file to hand on.
  const match = stdout.match(/Packed\s+.+?\s+->\s+(.+)$/m);
  const output = (match && match[1].trim()) || args.output || null;
  let sizeBytes = null;
  if (output) {
    const s = await stat(output).catch(() => null);
    if (s) sizeBytes = s.size;
  }
  return {
    dir,
    output,
    size_bytes: sizeBytes,
    notes:
      "The .mockz archive is on disk. Hand `output` to `serve_locally` " +
      "or `info` to inspect, or share the file/URL with someone else.",
  };
}

function baseName(input) {
  // Strip query/fragment if it's a URL; then the file basename without
  // extension.
  const noQuery = input.split(/[?#]/)[0];
  const base = path.basename(noQuery).replace(/\.[^.]+$/, "");
  return base || "spec";
}

function extFor(input) {
  const noQuery = input.split(/[?#]/)[0];
  const ext = path.extname(noQuery).toLowerCase();
  if (ext === ".json") return ".json";
  if (ext === ".yml" || ext === ".yaml") return ext;
  return ".yaml";
}

export function killAllLocal() {
  let killed = 0;
  for (const [pid, entry] of localServers.entries()) {
    try {
      entry.child.kill("SIGTERM");
      killed++;
    } catch {
      /* best-effort */
    }
    localServers.delete(pid);
  }
  return killed;
}

// Spawn the managed server with our sticky-port policy. Preferred
// order: (a) the port we got last time in this bridge session, (b)
// MANAGED_DEFAULT_PORT (2200 unless overridden), (c) kernel-pick.
//
// For (a) we skip the pre-bind probe — Node's net.createServer doesn't
// set SO_REUSEADDR, so it would falsely report a TIME_WAIT'd port as
// busy. mockzilla's Go listener uses SO_REUSEADDR and can claim the
// port just fine. Just try to spawn; if mockzilla fails, fall through.
//
// For (b) we DO probe — that catches the case where another process
// (orphan from a prior session, separate dev server, etc.) is actively
// LISTEN'd on the default port.
async function spawnManagedServer() {
  if (lastManagedPort) {
    try {
      const stamp = await spawnPortable({
        inputs: [MOCKS_ROOT],
        port: lastManagedPort,
        kind: "managed",
      });
      lastManagedPort = stamp.port;
      return stamp;
    } catch {
      // Last-port reuse failed (very unlikely with SO_REUSEADDR, but
      // possible if something else grabbed it). Fall through.
    }
  }

  if (
    Number.isInteger(MANAGED_DEFAULT_PORT) &&
    MANAGED_DEFAULT_PORT > 0 &&
    (await isPortFree(MANAGED_DEFAULT_PORT))
  ) {
    try {
      const stamp = await spawnPortable({
        inputs: [MOCKS_ROOT],
        port: MANAGED_DEFAULT_PORT,
        kind: "managed",
      });
      lastManagedPort = stamp.port;
      return stamp;
    } catch {
      // Default port was free at probe time but bind failed — race.
    }
  }

  const stamp = await spawnPortable({
    inputs: [MOCKS_ROOT],
    port: 0,
    kind: "managed",
  });
  lastManagedPort = stamp.port;
  return stamp;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, "0.0.0.0");
  });
}

async function spawnPortable({ inputs, port, kind }) {
  if (starting) {
    throw new Error(
      "Another spawn is in flight. Wait for it to finish, then retry.",
    );
  }
  starting = true;
  try {
    const resolved = await resolveMockzilla();
    if (!resolved) {
      throw new Error(
        "mockzilla is not installed. Call install_cli first " +
          "(ask the user to choose a method).",
      );
    }

    const cliArgs = ["--ready-stamp", "--port", String(port), ...inputs];
    const [cmd, ...prefix] =
      resolved.type === "binary" ? [resolved.path] : resolved.invocation;
    const child = spawn(cmd, [...prefix, ...cliArgs], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const ready = waitForReadyStamp(child);
    ready.finally(() => {
      child.stdout?.removeAllListeners("data");
      child.stdout?.resume();
    });

    const exited = new Promise((_, reject) => {
      child.once("exit", (code, signal) => {
        reject(
          new Error(
            `mockzilla exited before becoming ready (code=${code} signal=${signal})`,
          ),
        );
      });
      child.once("error", reject);
    });

    let stamp;
    try {
      stamp = await Promise.race([ready, exited, timeout(READY_TIMEOUT_MS)]);
    } catch (err) {
      if (!child.killed) child.kill("SIGTERM");
      throw err;
    }

    localServers.set(child.pid, {
      child,
      input: inputs,
      port: stamp.port,
      url: stamp.url,
      services: stamp.services,
      kind,
    });

    child.once("exit", () => localServers.delete(child.pid));

    return {
      pid: child.pid,
      port: stamp.port,
      url: stamp.url,
      services: stamp.services,
      via: resolved.source,
    };
  } finally {
    starting = false;
  }
}

// Refuse to start a new server when another one of the wrong kind is
// already running. `wantKind` is what the caller wants to start; if a
// running server matches we let the caller take care of restart logic
// itself (mock_endpoint kills+restarts; serve_locally errors).
function refuseIfBusy(wantKind) {
  if (localServers.size === 0) return;
  const [, entry] = localServers.entries().next().value;
  if (entry.kind === wantKind) {
    if (wantKind === "adhoc") {
      throw new Error(
        `A mockzilla server is already running at ${entry.url} ` +
          `(input=${JSON.stringify(entry.input)}). Mockzilla combines ` +
          `multiple APIs into one server — call stop_locally then start ` +
          `again with all the inputs you want, OR reuse this URL.`,
      );
    }
    return; // managed-on-managed: caller handles restart
  }
  if (entry.kind === "adhoc" && wantKind === "managed") {
    throw new Error(
      `An ad-hoc mockzilla server is currently running at ${entry.url} ` +
        `(serving ${JSON.stringify(entry.input)}). Call stop_locally first, ` +
        `then mock_endpoint will start a managed server pointing at the ` +
        `mocks dir.`,
    );
  }
  if (entry.kind === "managed" && wantKind === "adhoc") {
    throw new Error(
      `A managed mock_endpoint server is running at ${entry.url}. ` +
        `Call stop_locally first to free it before starting an ad-hoc ` +
        `server with serve_locally.`,
    );
  }
}

async function killManaged() {
  if (localServers.size === 0) return false;
  const [pid, entry] = localServers.entries().next().value;
  if (entry.kind !== "managed") return false;
  entry.child.kill("SIGTERM");
  await new Promise((resolve) => entry.child.once("exit", resolve));
  localServers.delete(pid);
  return true;
}

function adminUrls(port) {
  const base = `http://localhost:${port}`;
  return {
    services: `${base}/.services`, // {items:[{name, resourceNumber}]}
    home: `${base}/`,
    healthz: `${base}/healthz`,
    notes:
      "Hit these via call_endpoint to introspect the running server. " +
      "/.services lists registered services with endpoint counts.",
  };
}

function isLocalhost(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "::1" ||
      u.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function normaliseInputs(input) {
  if (Array.isArray(input)) {
    return input.filter((s) => typeof s === "string" && s.length > 0);
  }
  if (typeof input === "string" && input.length > 0) {
    return [input];
  }
  return [];
}

function extensionFor(contentType) {
  const ct = contentType.toLowerCase();
  if (ct.includes("json")) return "json";
  if (ct.includes("html")) return "html";
  if (ct.includes("xml")) return "xml";
  if (ct.includes("yaml") || ct.includes("yml")) return "yaml";
  return "txt";
}

function waitForReadyStamp(child) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        // mockzilla also writes coloured slog lines to stdout; skip
        // anything that doesn't look like our JSON stamp.
        if (!line.startsWith("{")) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed && parsed.status === "ready") {
            child.stdout.off("data", onData);
            resolve(parsed);
            return;
          }
        } catch {
          /* not the stamp; keep reading */
        }
      }
    };
    child.stdout.on("data", onData);
    child.stderr?.on("data", () => {});
    child.once("error", reject);
  });
}

function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(`Timed out after ${ms}ms waiting for mockzilla to become ready`),
        ),
      ms,
    ),
  );
}
