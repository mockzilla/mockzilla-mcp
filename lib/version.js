// Bridge version + npm registry update check.
//
// Even with `@latest` in the user's MCP config, there's still a window
// between an npm publish and the next client restart. The bridge checks
// the registry once per process and reports the result via the
// `bridge_status` tool so the agent can nudge the user when an update
// is available.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "package.json",
);

let cachedVersion = null;

export async function bridgeVersion() {
  if (cachedVersion) return cachedVersion;
  const raw = await readFile(PKG_PATH, "utf8");
  const pkg = JSON.parse(raw);
  cachedVersion = pkg.version;
  return cachedVersion;
}

let cachedLatest = null;
let cachedAt = 0;
const LATEST_CACHE_TTL_MS = 5 * 60_000; // 5 min

export async function latestPublishedVersion() {
  if (cachedLatest && Date.now() - cachedAt < LATEST_CACHE_TTL_MS) {
    return cachedLatest;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(
      "https://registry.npmjs.org/@mockzilla/mcp/latest",
      { signal: ctrl.signal },
    );
    if (!res.ok) return null;
    const body = await res.json();
    cachedLatest = body.version || null;
    cachedAt = Date.now();
    return cachedLatest;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function compareSemver(a, b) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

export async function bridgeStatus() {
  const current = await bridgeVersion();
  const latest = await latestPublishedVersion();
  const updateAvailable =
    latest != null && compareSemver(latest, current) > 0;

  return {
    bridge_version: current,
    bridge_latest: latest,
    update_available: updateAvailable,
    upgrade_steps: updateAvailable
      ? [
          "Run: npx clear-npx-cache @mockzilla/mcp",
          "Quit and reopen your MCP client (Claude Desktop / Cursor).",
          "If your config uses '@mockzilla/mcp@latest', the new version is fetched on the next launch automatically.",
        ]
      : null,
  };
}
