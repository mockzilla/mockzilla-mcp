// Walk a directory and report what mockzilla can do with it.
// The portable-mode layout has three shapes the runtime recognises:
//   * `services/<name>/` subdirectory tree, where each child of
//     services/ is one service with its own spec + optional config /
//     context, and optional static endpoint files anywhere underneath.
//   * Multiple top-level spec files at the dir root: flat root mode.
//     Each spec becomes its own service named after its basename.
//     An optional `context.yml` at the root is shared across services.
//   * A single service folder (with a spec, static endpoints, or a
//     `config.yml`): one service named after the dir basename.
// Static endpoints are detected anywhere by the pattern
// `<path>/<method?>/index.<ext>` (no `static/` wrapper required).
// All three shapes are valid `serve_locally` inputs, so the agent can
// pick the right entry point with the suggested_input hint.

import { exec as execCb } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { resolveMockzilla } from "./install.js";
import { shellEscape } from "./util.js";

const exec = promisify(execCb);

const SPEC_EXTS = new Set([".yml", ".yaml", ".json"]);
const STATIC_EXTS = new Set([".json", ".yml", ".yaml", ".xml", ".html", ".htm", ".txt"]);
const RESERVED_NAMES = new Set(["config.yml", "context.yml", "app.yml"]);
const SKIP_DIRS = new Set(["node_modules", "vendor", "target", "dist"]);

export async function discoverSpecs(args) {
  const dir = args.dir;
  if (typeof dir !== "string" || dir.length === 0) {
    throw new Error("`dir` must be a non-empty string");
  }
  const dirStat = await stat(dir).catch(() => null);
  if (!dirStat || !dirStat.isDirectory()) {
    throw new Error(`Not a directory: ${dir}`);
  }

  const services = await discoverServicesRoot(path.join(dir, "services"));

  const specFiles = [];
  for (const file of await listSpecFiles(dir)) {
    specFiles.push(await summariseSpec(file));
  }
  const hasStatic = await hasStaticEndpoints(dir);

  return {
    dir,
    services,
    spec_files: specFiles,
    has_static_endpoints: hasStatic,
    suggested_input: suggestInput(dir, services, specFiles, hasStatic),
  };
}

async function listSpecFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (RESERVED_NAMES.has(e.name)) continue;
    const base = e.name.replace(/\.[^.]+$/, "");
    if (base === "index") continue; // static endpoint, not a spec
    if (!SPEC_EXTS.has(path.extname(e.name).toLowerCase())) continue;
    out.push(path.join(dir, e.name));
  }
  return out;
}

function shouldSkipDir(name) {
  if (!name || name === ".") return false;
  if (name.startsWith(".") || name.startsWith("_")) return true;
  return SKIP_DIRS.has(name);
}

// hasStaticEndpoints reports whether the dir (recursively) contains at
// least one `<…>/index.<ext>` file. Used to flag a folder as having
// static-mode content even when no `static/` wrapper exists.
async function hasStaticEndpoints(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.isDirectory()) {
      if (shouldSkipDir(e.name)) continue;
      if (await hasStaticEndpoints(path.join(dir, e.name))) return true;
      continue;
    }
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (!STATIC_EXTS.has(ext)) continue;
    if (e.name.replace(ext, "") !== "index") continue;
    return true;
  }
  return false;
}

async function isDir(p) {
  const s = await stat(p).catch(() => null);
  return !!(s && s.isDirectory());
}

async function discoverServicesRoot(servicesDir) {
  if (!(await isDir(servicesDir))) return [];
  const entries = await readdir(servicesDir, { withFileTypes: true });
  const services = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const svcDir = path.join(servicesDir, e.name);
    const specs = await listSpecFiles(svcDir);
    const staticEndpoints = await hasStaticEndpoints(svcDir);
    services.push({
      name: e.name,
      path: svcDir,
      spec: specs[0] || null,
      has_static_endpoints: staticEndpoints,
    });
  }
  return services;
}

async function summariseSpec(file) {
  // Use `mockzilla info` for the heavy lifting so the spec parsing
  // logic stays in one place. If it fails, surface the error but keep
  // the entry; the agent can decide whether the file is salvageable.
  const resolved = await resolveMockzilla();
  if (!resolved) {
    return {
      path: file,
      error: "mockzilla CLI not installed; can't parse",
    };
  }
  const [cmd, ...prefix] =
    resolved.type === "binary" ? [resolved.path] : resolved.invocation;
  const cmdline = [cmd, ...prefix, "info", file].map(shellEscape).join(" ");
  try {
    const { stdout } = await exec(cmdline);
    const parsed = JSON.parse(stdout);
    return {
      path: file,
      title: parsed.title,
      version: parsed.version,
      openapi_version: parsed.openapi_version,
      endpoint_count: parsed.endpoint_count,
    };
  } catch (err) {
    return {
      path: file,
      error: (err.stderr && err.stderr.trim()) || err.message,
    };
  }
}

function suggestInput(dir, services, specs, hasStatic) {
  if (services.length > 0) {
    return {
      input: dir,
      reason:
        `Found ${services.length} service folder(s) under services/. ` +
        "Point serve_locally at the parent dir; mockzilla loads each one.",
    };
  }
  if (specs.length === 1 && !hasStatic) {
    return {
      input: specs[0].path,
      reason:
        "Single spec file at the root. Point serve_locally directly at it.",
    };
  }
  if (specs.length === 1 && hasStatic) {
    return {
      input: dir,
      reason:
        "Single spec plus static endpoint files. Point serve_locally at " +
        "the directory; the dir name becomes the service identity and " +
        "static files merge into or override spec endpoints.",
    };
  }
  if (specs.length > 1) {
    return {
      input: dir,
      reason:
        `Multiple top-level specs (${specs.length}) at the root. ` +
        "Point serve_locally at the directory; each spec becomes its " +
        "own service named after its filename (flat root mode).",
    };
  }
  if (hasStatic) {
    return {
      input: dir,
      reason:
        "Static endpoint files only, no spec. Point serve_locally at " +
        "the directory; mockzilla synthesizes a spec from the index.<ext> " +
        "files and names the service after the dir.",
    };
  }
  return null;
}
