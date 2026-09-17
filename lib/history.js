// Read the running local server's request history. The engine records
// every request per service and serves it at /.history, so this needs
// no account and no network beyond localhost.
//
// Two tools, deliberately separate: request_history lists what
// happened, diagnose_requests answers why a response looks wrong and
// where its data came from.

import { runningServer } from "./local.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const BODY_PREVIEW = 600;
const SLOW_MULTIPLE = 4;

export async function requestHistory(args = {}) {
  const server = requireServer();
  const services = await resolveServices(server, args.service);

  if (typeof args.id === "string" && args.id.length > 0) {
    if (services.length !== 1) {
      throw new Error("`id` needs `service` too: an id belongs to one service");
    }
    const entry = await fetchHistory(server, services[0], { id: args.id });
    const full = Array.isArray(entry.items) ? entry.items[0] : entry;
    if (!full) throw new Error(`No history entry ${args.id} in ${services[0]}`);
    return { service: services[0], entry: detail(full) };
  }

  const limit = clampLimit(args.limit);
  const all = [];
  for (const service of services) {
    const res = await fetchHistory(server, service, {});
    for (const item of res.items || []) all.push({ service, item });
  }
  const filtered = all
    .filter(({ item }) => matches(item, args))
    .sort((a, b) => stamp(b.item) - stamp(a.item));

  return {
    server_url: server.url,
    services,
    count: filtered.length,
    showing: Math.min(filtered.length, limit),
    entries: filtered.slice(0, limit).map(({ service, item }) => ({
      service,
      ...summary(item),
    })),
    notes:
      filtered.length === 0
        ? "No requests recorded yet. Call the mock, then read this again."
        : "Pass `id` with `service` for one entry's full headers and body.",
  };
}

export async function diagnoseRequests(args = {}) {
  const server = requireServer();
  const services = await resolveServices(server, args.service);
  const limit = clampLimit(args.limit, MAX_LIMIT);

  const rows = [];
  for (const service of services) {
    const res = await fetchHistory(server, service, {});
    for (const item of res.items || []) rows.push({ service, item });
  }
  rows.sort((a, b) => stamp(b.item) - stamp(a.item));
  // The summary has no headers, so the exact source needs the full
  // entry. "Where did this come from" is the point of this tool, so
  // pay for the detail fetch rather than guess from isFromUpstream.
  const recent = await withDetail(server, rows.slice(0, limit));

  if (recent.length === 0) {
    return {
      server_url: server.url,
      services,
      checked: 0,
      findings: [],
      notes: "No requests recorded yet, so there is nothing to diagnose.",
    };
  }

  const durations = recent
    .map(({ item }) => ms(item.response?.duration))
    .filter((n) => typeof n === "number")
    .sort((a, b) => a - b);

  return {
    server_url: server.url,
    services,
    checked: recent.length,
    // Whether the bytes came from a real backend or from the mock.
    data_origin: tally(recent, ({ item }) => source(item)),
    statuses: tally(recent, ({ item }) => String(item.response?.statusCode ?? "?")),
    content_types: tally(recent, ({ item }) => item.response?.contentType || "(none)"),
    latency_ms: durations.length
      ? {
          p50: pick(durations, 0.5),
          p95: pick(durations, 0.95),
          max: durations[durations.length - 1],
        }
      : null,
    findings: findProblems(recent, durations),
  };
}

function findProblems(recent, durations) {
  const out = [];
  const median = durations.length ? pick(durations, 0.5) : 0;

  for (const { service, item } of recent) {
    const res = item.response || {};
    const req = item.request || {};
    const where = `${req.method || "?"} ${req.url || "?"}`;

    if (res.upstreamError) {
      out.push({
        kind: "upstream_error",
        service,
        request: where,
        detail: `Upstream failed (${res.upstreamError}); the response fell back to a generated mock.`,
      });
    }
    const code = res.statusCode;
    if (typeof code === "number" && code >= 500) {
      out.push({
        kind: "server_error",
        service,
        request: where,
        status: code,
        detail: res.isFromUpstream
          ? "A 5xx that came from the real backend."
          : "A 5xx from the mock itself, so it is injected by `errors` or configured, not a real failure.",
      });
    } else if (code === 404) {
      out.push({
        kind: "not_found",
        service,
        request: where,
        status: 404,
        detail:
          "No operation matched this path. The mount prefix is part of the " +
          "URL, so check it against the served paths before assuming the mock is wrong.",
      });
    } else if (typeof code === "number" && code >= 400) {
      out.push({ kind: "client_error", service, request: where, status: code });
    }

    const type = res.contentType || "";
    if (type && !type.includes("json") && looksJson(res.body)) {
      out.push({
        kind: "content_type_mismatch",
        service,
        request: where,
        detail: `Body parses as JSON but Content-Type is "${type}".`,
      });
    }

    const took = ms(res.duration);
    if (
      typeof took === "number" &&
      median > 0 &&
      took > median * SLOW_MULTIPLE &&
      took > 50
    ) {
      out.push({
        kind: "slow",
        service,
        request: where,
        duration_ms: took,
        detail: `${took}ms against a ${median}ms median. Configured latency applies to every request, so a single outlier is usually the spec's size, not config.`,
      });
    }
  }
  return out;
}

const DETAIL_CONCURRENCY = 8;

async function withDetail(server, rows) {
  const out = new Array(rows.length);
  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const i = next++;
      const { service, item } = rows[i];
      const res = await fetchHistory(server, service, { id: item.id }).catch(
        () => null,
      );
      const full = res && (Array.isArray(res.items) ? res.items[0] : res);
      out[i] = { service, item: full || item };
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(DETAIL_CONCURRENCY, rows.length) }, worker),
  );
  return out;
}

function base(server) {
  return server.url.replace(/\/$/, "");
}

function requireServer() {
  const server = runningServer();
  if (!server) {
    throw new Error(
      "No local mockzilla server is running, and history lives in the " +
        "running server. Start one with serve_locally or mock_endpoint, " +
        "call the endpoints, then read the history.",
    );
  }
  return server;
}

// /.history is per service, so a missing `service` means every service
// the server has registered.
async function resolveServices(server, requested) {
  if (typeof requested === "string" && requested.length > 0) return [requested];
  if (server.services?.length) return server.services.map((s) => s.name);
  const res = await fetch(`${base(server)}/.services`).catch(() => null);
  if (!res || !res.ok) return [];
  const body = await res.json().catch(() => ({}));
  return (body.items || []).map((s) => s.name).filter(Boolean);
}

async function fetchHistory(server, service, extra) {
  const url = new URL(`${base(server)}/.history`);
  url.searchParams.set("service", service);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (res.status === 404) {
    throw new Error(
      `No history for service "${service}". Either the name is wrong or ` +
        "history is off for it (`history: false` in its config.yml).",
    );
  }
  if (!res.ok) {
    throw new Error(`History API returned ${res.status} for "${service}"`);
  }
  return await res.json();
}

// The list projection carries no headers, so `from_upstream` is all
// the source information it actually has. Naming a precise source
// here would mislabel a replay or cache hit as generated.
function summary(item) {
  const res = item.response || {};
  const req = item.request || {};
  return {
    id: item.id,
    at: item.createdAt,
    method: req.method,
    url: req.url,
    status: res.statusCode,
    content_type: res.contentType || null,
    duration_ms: ms(res.duration),
    from_upstream: !!res.isFromUpstream,
    ...(res.upstreamError ? { upstream_error: res.upstreamError } : {}),
  };
}

function detail(item) {
  const res = item.response || {};
  const req = item.request || {};
  return {
    ...summary(item),
    resource: item.resource || null,
    request_headers: req.headers || [],
    request_body: decode(req.body, req.isBodyTruncated),
    response_headers: res.headers || [],
    response_body: decode(res.body, res.isBodyTruncated),
    from_upstream: !!res.isFromUpstream,
    upstream_url: res.upstreamURL || null,
    upstream_error: res.upstreamError || null,
  };
}

// Where the data came from, from the one recorded field that is
// trustworthy. The stored X-Mockzilla-Source header is NOT: a response
// served to the client as `upstream` is recorded with `cache`, because
// the entry is written on the cache path. isFromUpstream matches the
// wire, so provenance is a two-way answer, not the engine's four-way
// source taxonomy. Live-vs-cache is only visible on the response
// header at call time, which call_endpoint shows.
function source(item) {
  const res = item.response || {};
  if (res.upstreamError) return "mock (upstream failed)";
  return res.isFromUpstream ? "upstream" : "mock";
}

function matches(item, args) {
  const res = item.response || {};
  const req = item.request || {};
  if (args.method && (req.method || "").toUpperCase() !== String(args.method).toUpperCase()) {
    return false;
  }
  if (Number.isInteger(args.status) && res.statusCode !== args.status) return false;
  if (args.failed_only === true && !(res.statusCode >= 400)) return false;
  if (
    typeof args.path_contains === "string" &&
    args.path_contains.length > 0 &&
    !(req.url || "").includes(args.path_contains)
  ) {
    return false;
  }
  return true;
}

function decode(body, truncated) {
  if (!body) return null;
  let text;
  try {
    text = Buffer.from(body, "base64").toString("utf8");
  } catch {
    return "(unreadable)";
  }
  const suffix = truncated ? " …(truncated by the engine)" : "";
  return text.length > BODY_PREVIEW
    ? `${text.slice(0, BODY_PREVIEW)}…${suffix}`
    : text + suffix;
}

function looksJson(body) {
  if (!body) return false;
  try {
    const text = Buffer.from(body, "base64").toString("utf8").trim();
    if (!text.startsWith("{") && !text.startsWith("[")) return false;
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

// The engine reports durations in nanoseconds.
function ms(ns) {
  if (typeof ns !== "number") return null;
  return Math.round((ns / 1e6) * 1000) / 1000;
}

function stamp(item) {
  const t = Date.parse(item.createdAt || "");
  return Number.isNaN(t) ? 0 : t;
}

function tally(rows, keyOf) {
  const out = {};
  for (const row of rows) {
    const key = keyOf(row);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function pick(sorted, q) {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[i];
}

function clampLimit(value, max = MAX_LIMIT) {
  if (!Number.isInteger(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(max, value));
}
