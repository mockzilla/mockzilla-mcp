// Replay: record a response once, serve it back for every matching
// request. Configured in a service's config.yml, so setting it up is a
// file write, not a flag.
//
// The bridge writes that file only inside its own mocks dir. For a
// folder the user served from their own project it returns the YAML
// and the path instead, and the agent shows it rather than editing
// someone's repo.

import { readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { runningServer } from "./local.js";

const MOCKS_SERVICES_DIR = path.join(
  homedir(),
  ".cache",
  "mockzilla-mcp",
  "mocks",
  "services",
);

const GO_DURATION = /^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$/;
const METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

export async function setupReplay(args = {}) {
  const service = args.service;
  if (typeof service !== "string" || service.length === 0) {
    throw new Error("`service` must be the name of a service to record");
  }
  const endpoints = normaliseEndpoints(args.endpoints);
  const upstreamUrl =
    typeof args.upstream_url === "string" && args.upstream_url.length > 0
      ? args.upstream_url
      : null;

  if (args.duration !== undefined && !GO_DURATION.test(String(args.duration))) {
    throw new Error("`duration` must be a Go duration like \"24h\" or \"30m\"");
  }

  // upstream-only makes the engine REFUSE to record anything that did
  // not come from a real backend, answering 502 instead. Without an
  // upstream that is every single request.
  if (args.upstream_only === true && !upstreamUrl) {
    throw new Error(
      "`upstream_only` records only real backend responses, so without an " +
        "upstream every request fails with 502 \"upstream-only is configured " +
        "but response source is generated\". Pass `upstream_url` too, or " +
        "drop `upstream_only` to record the generated responses instead.",
    );
  }

  const yaml = renderConfig({
    endpoints,
    autoReplay: args.auto_replay === true,
    upstreamOnly: args.upstream_only === true,
    duration: args.duration,
    upstreamUrl,
  });

  const target = await resolveTarget(service, args.dir);
  const guidance = {
    service,
    recording_scope: endpoints.map(scopeOf),
    config_yaml: yaml,
    config_path: target.file,
    how_to_record: howToRecord(endpoints, args.auto_replay === true),
    what_gets_recorded: upstreamUrl
      ? `Responses from ${upstreamUrl}. If it is unreachable the engine falls back to a generated response` +
        (args.upstream_only === true
          ? ", and upstream_only turns that into a 502 rather than recording it."
          : ", which is then what gets recorded.")
      : "The generated responses, which pins the random data so repeat " +
        "matching requests return identical values. Point `upstream_url` at " +
        "a real backend to record real responses instead.",
  };

  if (!target.writable) {
    return {
      ...guidance,
      written: false,
      notes:
        `${service} is served from ${target.dir}, outside the bridge's own ` +
        "mocks dir, so nothing was written. Show the user `config_yaml` and " +
        `where it goes (${target.file}), then restart the server to pick it up.`,
    };
  }

  const existing = await readFile(target.file, "utf8").catch(() => null);
  if (existing && /^\s*replay\s*:/m.test(existing)) {
    return {
      ...guidance,
      written: false,
      notes:
        `${target.file} already has a replay block. It was left alone rather ` +
        "than overwritten: merge `config_yaml` into it by hand.",
    };
  }
  if (existing && upstreamUrl && /^\s*upstream\s*:/m.test(existing)) {
    return {
      ...guidance,
      written: false,
      notes:
        `${target.file} already has an upstream block. It was left alone ` +
        "rather than overwritten: merge `config_yaml` into it by hand.",
    };
  }

  const merged = existing ? `${existing.trimEnd()}\n\n${yaml}` : yaml;
  await writeFile(target.file, merged);
  return {
    ...guidance,
    written: true,
    notes:
      "Written. The server only reads config.yml at startup, so restart it " +
      "(stop_locally then serve again, or any mock_endpoint call) before recording.",
  };
}

export async function listReplays(args = {}) {
  const server = runningServer();
  if (!server) {
    throw new Error(
      "No local mockzilla server is running. Recordings live in the running " +
        "server, so start one first.",
    );
  }
  const service = args.service;
  if (typeof service !== "string" || service.length === 0) {
    throw new Error("`service` must be the service whose recordings to list");
  }
  const url = new URL(`${server.url.replace(/\/$/, "")}/.replay`);
  url.searchParams.set("service", service);
  if (typeof args.key === "string" && args.key) url.searchParams.set("key", args.key);

  const res = await fetch(url);
  if (res.status === 404) {
    throw new Error(
      `No replay data for "${service}". Either the name is wrong, or replay ` +
        "is not configured for it: call setup_replay first.",
    );
  }
  if (!res.ok) throw new Error(`Replay API returned ${res.status}`);
  const body = await res.json();
  const items = body.items || [];
  return {
    service,
    count: items.length,
    truncated: !!body.truncated,
    recordings: items,
    notes:
      items.length === 0
        ? "Replay is configured but nothing is recorded yet. Send a matching " +
          "request with the X-Mockzilla-Replay header to record the first one."
        : "A matching request now returns one of these instead of a fresh response.",
  };
}

function normaliseEndpoints(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      "`endpoints` must list at least one endpoint to record, e.g. " +
        "[{path: \"/orders\", method: \"POST\", match: {body: [\"reference\"]}}]",
    );
  }
  return raw.map((e, i) => {
    if (!e || typeof e !== "object") throw new Error(`endpoints[${i}] must be an object`);
    if (typeof e.path !== "string" || !e.path.startsWith("/")) {
      throw new Error(`endpoints[${i}].path must be a path starting with /`);
    }
    const method = e.method === undefined ? null : String(e.method).toUpperCase();
    if (method !== null && !METHODS.has(method)) {
      throw new Error(`endpoints[${i}].method ${method} is not an HTTP method`);
    }
    const match = e.match ?? null;
    if (match !== null) {
      if (typeof match !== "object" || Array.isArray(match)) {
        throw new Error(`endpoints[${i}].match must be an object`);
      }
      for (const key of Object.keys(match)) {
        if (!["path", "body", "query"].includes(key)) {
          throw new Error(
            `endpoints[${i}].match.${key} is not a match source; use path, body or query`,
          );
        }
        if (!Array.isArray(match[key]) || match[key].some((f) => typeof f !== "string")) {
          throw new Error(`endpoints[${i}].match.${key} must be a list of field names`);
        }
      }
    }
    return { path: e.path, method, match };
  });
}

// Hand-rolled because the bridge ships no dependencies. The shape here
// is fixed and shallow, so this stays a few lines rather than a parser.
function renderConfig({ endpoints, autoReplay, upstreamOnly, duration, upstreamUrl }) {
  const lines = [];
  if (upstreamUrl) {
    lines.push("upstream:", `  url: ${upstreamUrl}`, "");
  }
  lines.push("replay:");
  if (duration) lines.push(`  duration: ${duration}`);
  if (autoReplay) lines.push("  auto-replay: true");
  if (upstreamOnly) lines.push("  upstream-only: true");
  lines.push("  endpoints:");
  for (const e of endpoints) {
    lines.push(`    ${quote(e.path)}:`);
    if (!e.method) continue;
    lines.push(`      ${e.method}:`);
    if (!e.match) continue;
    lines.push("        match:");
    for (const source of ["path", "body", "query"]) {
      const fields = e.match[source];
      if (!fields || fields.length === 0) continue;
      lines.push(`          ${source}:`);
      for (const f of fields) lines.push(`            - ${quote(f)}`);
    }
  }
  return lines.join("\n") + "\n";
}

// A top-level-array body field is written "[0].name", and unquoted
// that is a YAML flow sequence rather than a string. Same for a path
// key or a field that starts with any other indicator.
function quote(s) {
  return /^[A-Za-z0-9/_.-][A-Za-z0-9/_.{}[\]-]*$/.test(s)
    ? s
    : `"${String(s).replace(/(["\\])/g, "\\$1")}"`;
}

// Whether one recording covers the endpoint or each distinct value
// gets its own. Getting this wrong is quiet: with no match fields the
// first response comes back for every later call, whatever was sent.
function scopeOf(e) {
  const where = `${e.method || "ANY"} ${e.path}`;
  if (!e.match) {
    return {
      endpoint: where,
      keyed_by: "method and path only",
      means:
        `Every ${where} call shares ONE recording: the first response is ` +
        "replayed for all later calls, whatever body or query they send. " +
        "Add `match` fields to give different values their own recordings.",
    };
  }
  const fields = Object.entries(e.match).flatMap(([source, list]) =>
    list.map((f) => `${source}:${f}`),
  );
  return {
    endpoint: where,
    keyed_by: fields.join(", "),
    means:
      `One recording per distinct combination of ${fields.join(" + ")}. ` +
      "Anything not listed is ignored, so calls differing only in those " +
      "other values share a recording.",
  };
}

function howToRecord(endpoints, autoReplay) {
  if (autoReplay) {
    return (
      "auto-replay is on, so a normal request to a configured endpoint " +
      "records on the first call and replays afterwards. No header needed."
    );
  }
  const first = endpoints[0];
  const fields = first.match
    ? Object.entries(first.match)
        .flatMap(([source, list]) => list.map((f) => `${source}:${f}`))
        .join(",")
    : "";
  const where = `${first.method || "ANY"} ${first.path}`;
  return (
    "Send the X-Mockzilla-Replay header. An empty value uses the configured " +
    "match fields, a value overrides them. The first matching call records, " +
    "later ones replay and carry X-Mockzilla-Source: replay.\n" +
    `  curl -H 'X-Mockzilla-Replay: ${fields}' ...   # ${where}\n` +
    "  curl -H 'X-Mockzilla-Replay;' ...             # empty, uses the config\n" +
    "Note the trailing semicolon on the empty form: curl reads " +
    "-H 'X-Mockzilla-Replay:' as an instruction to REMOVE the header, so " +
    "that spelling silently disables replay. call_endpoint has no such " +
    "quirk; pass the header with an empty string."
  );
}

// Only the bridge's own mocks tree is writable. Anything else is the
// user's directory and gets instructions instead of an edit.
async function resolveTarget(service, dir) {
  if (typeof dir === "string" && dir.length > 0) {
    const resolved = path.resolve(dir);
    return {
      dir: resolved,
      file: path.join(resolved, "config.yml"),
      writable: isInside(resolved, MOCKS_SERVICES_DIR),
    };
  }
  const managed = path.join(MOCKS_SERVICES_DIR, service);
  const exists = await stat(managed)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (exists) {
    return { dir: managed, file: path.join(managed, "config.yml"), writable: true };
  }
  const server = runningServer();
  const hint = server?.services?.find((s) => s.name === service);
  return {
    dir: hint ? `the directory serving ${service}` : "<the service directory>",
    file: `<service dir>/${service}/config.yml`,
    writable: false,
  };
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
