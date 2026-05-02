// Walk a directory and report what mockzilla can do with it.
// Two recognised shapes:
//   • OpenAPI spec files at the top level (.yml/.yaml/.json with an
//     `openapi:` field — verified via `mockzilla info`).
//   • A `static/` subdirectory; each child of static/ is a service.
// Both shapes are valid `serve_locally` inputs, so the agent can choose.

import { exec as execCb } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { resolveMockzilla } from "./install.js";
import { shellEscape } from "./util.js";

const exec = promisify(execCb);

const SPEC_EXTS = new Set([".yml", ".yaml", ".json"]);

export async function discoverSpecs(args) {
  const dir = args.dir;
  if (typeof dir !== "string" || dir.length === 0) {
    throw new Error("`dir` must be a non-empty string");
  }
  const dirStat = await stat(dir).catch(() => null);
  if (!dirStat || !dirStat.isDirectory()) {
    throw new Error(`Not a directory: ${dir}`);
  }

  const specFiles = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!SPEC_EXTS.has(path.extname(entry.name).toLowerCase())) continue;
    const full = path.join(dir, entry.name);
    specFiles.push(await summariseSpec(full));
  }

  const staticDir = path.join(dir, "static");
  const staticServices = await discoverStaticServices(staticDir);

  return {
    dir,
    spec_files: specFiles,
    static_services: staticServices,
    suggested_input: suggestInput(dir, specFiles, staticServices),
  };
}

async function summariseSpec(file) {
  // Use `mockzilla info` for the heavy lifting so the spec parsing
  // logic stays in one place. If it fails, surface the error but keep
  // the entry — the agent can decide whether the file is salvageable.
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

async function discoverStaticServices(staticDir) {
  const s = await stat(staticDir).catch(() => null);
  if (!s || !s.isDirectory()) return [];
  const entries = await readdir(staticDir, { withFileTypes: true });
  const services = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    services.push({
      name: e.name,
      path: path.join(staticDir, e.name),
    });
  }
  return services;
}

function suggestInput(dir, specs, services) {
  if (services.length > 0 && specs.length === 0) {
    return {
      input: dir,
      reason:
        "Directory has a `static/` subdir — point serve_locally at the " +
        "parent dir; mockzilla auto-generates specs from each service.",
    };
  }
  if (specs.length === 1 && services.length === 0) {
    return {
      input: specs[0].path,
      reason: "Single spec file — point serve_locally directly at it.",
    };
  }
  if (specs.length > 1) {
    return {
      input: dir,
      reason:
        "Multiple specs — point serve_locally at the directory; each " +
        "spec becomes its own service.",
    };
  }
  if (services.length > 0 && specs.length > 0) {
    return {
      input: dir,
      reason:
        "Mix of static services and specs — point serve_locally at the " +
        "directory; mockzilla picks up both.",
    };
  }
  return null;
}
