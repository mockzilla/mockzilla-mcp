// Install + resolve. Owns the bridge's mockzilla cache and the
// `check_cli` / `install_cli` tools the agent calls.
//
// Cache layout under ~/.cache/mockzilla-mcp/:
//   bin/mockzilla(.exe)  — downloaded or go-installed binary
//   config.json          — {method, version, invocation?} record of how
//                          the cache was populated, so resolveMockzilla
//                          can pick the right invocation later

import { exec as execCb } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile, readFile, chmod, rename } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

import { shellEscape } from "./util.js";

const exec = promisify(execCb);

export const MOCKZILLA_VERSION =
  process.env.MOCKZILLA_BIN_VERSION || "2.5.0";
export const MOCKZILLA_MODULE = "github.com/mockzilla/mockzilla/v2/cmd/mockzilla";

const CACHE_DIR = path.join(homedir(), ".cache", "mockzilla-mcp");
const CACHE_BIN_DIR = path.join(CACHE_DIR, "bin");
const CACHE_BIN_NAME =
  process.platform === "win32" ? "mockzilla.exe" : "mockzilla";
const CACHE_BIN_PATH = path.join(CACHE_BIN_DIR, CACHE_BIN_NAME);
const CACHE_CONFIG_PATH = path.join(CACHE_DIR, "config.json");

export async function checkCli() {
  const resolved = await resolveMockzilla();
  if (resolved) {
    return {
      installed: true,
      source: resolved.source,
      version: resolved.version,
      ...(resolved.type === "binary"
        ? { path: resolved.path }
        : { invocation: resolved.invocation }),
    };
  }

  const goAvailable = await hasGo();
  return {
    installed: false,
    install_options: buildInstallOptions(goAvailable),
    notes:
      "No mockzilla CLI on PATH or in the bridge cache. Suggest " +
      "`install_cli`; ask the user whether they want to download the " +
      "prebuilt binary, build from source via `go install`, or skip " +
      "install entirely and use `go run`.",
  };
}

export async function installCli(args) {
  const method = args.method || "download";
  await mkdir(CACHE_BIN_DIR, { recursive: true });

  if (method === "download") return await installViaDownload();
  if (method === "go-install") return await installViaGoInstall();
  if (method === "go-run") return await installViaGoRun();
  throw new Error(`Unknown install method: ${method}`);
}

// resolveMockzilla returns how to invoke mockzilla on this machine, or
// null if it isn't available. Resolution order: system PATH → bridge
// cache binary → cached `go-run` invocation. Each candidate is verified
// (with `--version` for binaries, with `go version` for go-run) so
// stale cache entries don't poison serve_locally.
export async function resolveMockzilla() {
  try {
    const { stdout } = await exec("mockzilla --version");
    return {
      type: "binary",
      path: "mockzilla",
      version: stdout.trim().replace(/^v/, ""),
      source: "system",
    };
  } catch {
    /* not on PATH */
  }

  const config = await readConfig();
  if (config && (config.method === "download" || config.method === "go-install")) {
    try {
      const { stdout } = await exec(
        `${shellEscape(CACHE_BIN_PATH)} --version`,
      );
      return {
        type: "binary",
        path: CACHE_BIN_PATH,
        version: stdout.trim().replace(/^v/, ""),
        source: "cache",
      };
    } catch {
      /* cache binary missing or broken */
    }
  }

  if (
    config &&
    config.method === "go-run" &&
    Array.isArray(config.invocation) &&
    (await hasGo())
  ) {
    return {
      type: "go-run",
      invocation: config.invocation,
      version: config.version,
      source: "go-run",
    };
  }

  return null;
}

function buildInstallOptions(goAvailable) {
  const options = [
    {
      method: "download",
      recommended: true,
      requires: ["network access to github.com"],
      summary:
        `Pull the prebuilt mockzilla v${MOCKZILLA_VERSION} binary for ` +
        `${process.platform}/${process.arch} into the bridge cache.`,
    },
  ];
  if (goAvailable) {
    options.push({
      method: "go-install",
      requires: ["go on PATH"],
      summary:
        `Compile mockzilla v${MOCKZILLA_VERSION} from source via ` +
        `\`go install\`. Audit-friendly; needs the Go toolchain.`,
    });
    options.push({
      method: "go-run",
      requires: ["go on PATH"],
      summary:
        `Skip install: future serve_locally calls will use ` +
        `\`go run ${MOCKZILLA_MODULE}@v${MOCKZILLA_VERSION}\`. ` +
        `First run compiles into Go's module cache; later runs are instant.`,
    });
  } else {
    for (const method of ["go-install", "go-run"]) {
      options.push({
        method,
        requires: ["go on PATH"],
        available: false,
        summary: "Go is not on PATH; install Go first if you want this method.",
      });
    }
  }
  return options;
}

async function installViaDownload() {
  const goos = nodePlatformToGoos(process.platform);
  const goarch = nodeArchToGoarch(process.arch);
  if (!goos || !goarch) {
    throw new Error(
      `No prebuilt binary for ${process.platform}/${process.arch}. ` +
        `Try method: "go-install" or "go-run".`,
    );
  }
  const ext = goos === "windows" ? ".exe" : "";
  const assetName = `mockzilla-v${MOCKZILLA_VERSION}-${goos}-${goarch}${ext}`;
  const url = `https://github.com/mockzilla/mockzilla/releases/download/v${MOCKZILLA_VERSION}/${assetName}`;

  const tmpPath = `${CACHE_BIN_PATH}.partial`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download failed: ${res.status} ${res.statusText} ${url}`);
  }
  await pipeline(res.body, createWriteStream(tmpPath));
  await chmod(tmpPath, 0o755);
  await rename(tmpPath, CACHE_BIN_PATH);

  await writeConfig({ method: "download", version: MOCKZILLA_VERSION });

  const { stdout } = await exec(`${shellEscape(CACHE_BIN_PATH)} --version`);
  return {
    method: "download",
    version: stdout.trim().replace(/^v/, ""),
    path: CACHE_BIN_PATH,
    asset: assetName,
  };
}

async function installViaGoInstall() {
  if (!(await hasGo())) {
    throw new Error(
      'Go is not on PATH. Install Go first or use method: "download".',
    );
  }
  const target = `${MOCKZILLA_MODULE}@v${MOCKZILLA_VERSION}`;
  const { stdout: gobinRaw } = await exec("go env GOBIN");
  let gobin = gobinRaw.trim();
  if (!gobin) {
    const { stdout: gopathRaw } = await exec("go env GOPATH");
    gobin = path.join(gopathRaw.trim(), "bin");
  }
  await exec(`go install ${target}`);
  const compiledPath = path.join(gobin, CACHE_BIN_NAME);
  await exec(`cp ${shellEscape(compiledPath)} ${shellEscape(CACHE_BIN_PATH)}`);
  await chmod(CACHE_BIN_PATH, 0o755);
  await writeConfig({ method: "go-install", version: MOCKZILLA_VERSION });

  const { stdout } = await exec(`${shellEscape(CACHE_BIN_PATH)} --version`);
  return {
    method: "go-install",
    version: stdout.trim().replace(/^v/, ""),
    path: CACHE_BIN_PATH,
    source_module: target,
  };
}

async function installViaGoRun() {
  if (!(await hasGo())) {
    throw new Error(
      'Go is not on PATH. Install Go first or use method: "download".',
    );
  }
  const invocation = ["go", "run", `${MOCKZILLA_MODULE}@v${MOCKZILLA_VERSION}`];
  await writeConfig({
    method: "go-run",
    version: MOCKZILLA_VERSION,
    invocation,
  });
  return {
    method: "go-run",
    version: MOCKZILLA_VERSION,
    invocation,
    notes:
      "Nothing was downloaded. The first serve_locally call will compile " +
      "via Go's module cache (slow first time, instant after).",
  };
}

async function readConfig() {
  try {
    const raw = await readFile(CACHE_CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeConfig(cfg) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

async function hasGo() {
  try {
    await exec("go version");
    return true;
  } catch {
    return false;
  }
}

function nodePlatformToGoos(p) {
  return { darwin: "darwin", linux: "linux", win32: "windows" }[p];
}

function nodeArchToGoarch(a) {
  return { x64: "amd64", arm64: "arm64" }[a];
}
