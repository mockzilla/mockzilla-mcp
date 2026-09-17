// The GitHub publish tools, exercised where nothing is created:
// checking a local folder, and the guards that must refuse before any
// repository is touched. Needs no gh login and no network.
// Run via `node scripts/github-smoke.mjs`.

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const home = await mkdtemp(path.join(tmpdir(), "mockzilla-mcp-gh-"));

// A portable repo: one service, no workflow.
const portable = path.join(home, "portable");
await mkdir(path.join(portable, "services", "orders", "ping", "get"), { recursive: true });
await writeFile(
  path.join(portable, "services", "orders", "ping", "get", "index.json"),
  JSON.stringify({ ok: true }),
);

// A codegen repo: go.mod plus cmd/server.
const codegen = path.join(home, "codegen");
await mkdir(path.join(codegen, "cmd", "server"), { recursive: true });
await writeFile(path.join(codegen, "go.mod"), "module example.com/mocks\n\ngo 1.25\n");
await writeFile(path.join(codegen, "cmd", "server", "main.go"), "package main\n\nfunc main() {}\n");

// A portable repo whose teardown lives in its own workflow, which is
// the shape the action's docs describe.
const separate = path.join(home, "separate");
await mkdir(path.join(separate, "services", "pets"), { recursive: true });
await writeFile(path.join(separate, "services", "pets", "openapi.yml"), "openapi: 3.0.0\n");
await mkdir(path.join(separate, ".github", "workflows"), { recursive: true });
await writeFile(
  path.join(separate, ".github", "workflows", "mockzilla.yml"),
  `name: mockzilla
on:
  push: {branches: [main]}
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: mockzilla/actions@v1
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
`,
);
await writeFile(
  path.join(separate, ".github", "workflows", "mockzilla-remove.yml"),
  `name: mockzilla-remove
on:
  workflow_dispatch:
jobs:
  remove:
    runs-on: ubuntu-latest
    steps:
      - uses: mockzilla/actions@v1
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
          delete: true
`,
);

// A portable repo that is already wired up correctly.
const wired = path.join(home, "wired");
await mkdir(path.join(wired, "services", "pets"), { recursive: true });
await writeFile(path.join(wired, "services", "pets", "openapi.yml"), "openapi: 3.0.0\n");
await mkdir(path.join(wired, ".github", "workflows"), { recursive: true });
await writeFile(
  path.join(wired, ".github", "workflows", "mockzilla.yml"),
  `name: mockzilla
on:
  push: {branches: [main]}
  pull_request: {types: [opened, synchronize, reopened, closed]}
  workflow_dispatch: {inputs: {delete: {type: boolean, default: false}}}
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mockzilla/actions@v1
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
          delete: \${{ inputs.delete || false }}
`,
);

// The same, but the delete input is declared and never passed to the
// action, so a manual run publishes instead of removing. It looks wired
// up and is not.
const halfWired = path.join(home, "half-wired");
await mkdir(path.join(halfWired, "services", "pets"), { recursive: true });
await writeFile(path.join(halfWired, "services", "pets", "openapi.yml"), "openapi: 3.0.0\n");
await mkdir(path.join(halfWired, ".github", "workflows"), { recursive: true });
await writeFile(
  path.join(halfWired, ".github", "workflows", "mockzilla.yml"),
  `name: mockzilla
on:
  push: {branches: [main]}
  workflow_dispatch: {inputs: {delete: {type: boolean, default: false}}}
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: mockzilla/actions@v1
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
`,
);

const bridge = startBridge();
try {
  await bridge.call("initialize", { protocolVersion: "2025-06-18" });

  const missing = parse(
    await bridge.call("tools/call", {
      name: "check_github_deployable",
      arguments: { dir: portable },
    }),
  );
  check(missing.deployable === false, "a repo with no workflow is not deployable");
  check(
    missing.problems.some((p) => /mockzilla\/actions/.test(p.what)),
    "it says the workflow is what is missing",
  );
  check(
    /mockzilla\/actions/.test(missing.workflow_to_add || ""),
    "it offers a publish workflow to add",
  );
  check(
    !/inputs\.delete/.test(missing.workflow_to_add || "") &&
      !/workflow_dispatch/.test(missing.workflow_to_add || ""),
    "which carries no delete plumbing: teardown is its own workflow",
  );
  check(
    missing.problems.every((p) => p.why && p.fix),
    "every problem says why it matters and how to fix it",
  );

  const good = parse(
    await bridge.call("tools/call", {
      name: "check_github_deployable",
      arguments: { dir: wired },
    }),
  );
  check(good.deployable === true, "a correctly wired repo is deployable");
  check(good.workflow_to_add === null, "it does not offer to rewrite an existing workflow");
  check(good.warnings.length === 0, `a complete workflow raises no warnings (${JSON.stringify(good.warnings)})`);
  check(
    good.teardown_workflow === "mockzilla.yml",
    `a delete input on the publish workflow counts as teardown (got ${good.teardown_workflow})`,
  );

  // The documented shape: teardown in a workflow of its own.
  const sep = parse(
    await bridge.call("tools/call", {
      name: "check_github_deployable",
      arguments: { dir: separate },
    }),
  );
  check(
    sep.teardown_workflow === "mockzilla-remove.yml",
    `a dedicated remove workflow counts as teardown (got ${sep.teardown_workflow})`,
  );
  check(sep.warnings.length === 0, "and raises no warnings");
  check(sep.teardown_workflow_to_add === null, "so nothing is offered to add");

  // A delete input that never reaches the action removes nothing, so it
  // must not count as teardown just because the trigger is there.
  const half = parse(
    await bridge.call("tools/call", {
      name: "check_github_deployable",
      arguments: { dir: halfWired },
    }),
  );
  check(
    half.teardown_workflow === null,
    `an unpassed delete input is not teardown (got ${half.teardown_workflow})`,
  );
  check(
    half.warnings.some((w) => /take the mocks down/.test(w.what)),
    "and it is still flagged",
  );

  // The advice must be the documented one, and must not point at a
  // field that is empty in this very response.
  const noTeardown = half.warnings.find((w) => /take the mocks down/.test(w.what));
  check(/mockzilla-remove\.yml/.test(noTeardown.fix), "the fix names the workflow to add");
  check(
    !/`workflow_to_add`/.test(noTeardown.fix),
    "the fix does not point at workflow_to_add, which is null when a workflow exists",
  );
  check(half.workflow_to_add === null, "and workflow_to_add is indeed null here");
  check(
    typeof half.teardown_workflow_to_add === "string" &&
      /delete: true/.test(half.teardown_workflow_to_add),
    "a ready-made remove workflow is returned instead",
  );

  // Judging a codegen repo by the portable layout would tell the user
  // to add a services/ folder it must not have.
  const gen = parse(
    await bridge.call("tools/call", {
      name: "check_github_deployable",
      arguments: { dir: codegen },
    }),
  );
  check(gen.mode === "codegen", `a go.mod plus cmd/server reads as codegen (got ${gen.mode})`);
  check(
    !gen.problems.some((p) => /services/.test(p.what)),
    "it does not ask a codegen repo for service folders",
  );

  const both = await bridge.call("tools/call", {
    name: "check_github_deployable",
    arguments: { dir: portable, repo: "acme/mocks" },
  });
  check(both.result?.isError === true, "passing both repo and dir is refused");

  // These must refuse before anything is created or pushed.
  for (const [args, what] of [
    [{ repo: "acme/mocks" }, "visibility is required"],
    [{ repo: "acme/mocks", visibility: "maybe" }, "visibility must be private or public"],
    [{ repo: "not-a-repo", visibility: "private" }, "repo must be owner/name"],
    [
      { repo: "acme/mocks", visibility: "private", services_dir: "../escape" },
      "services_dir may not escape the repo",
    ],
  ]) {
    const res = await bridge.call("tools/call", {
      name: "publish_to_github",
      arguments: args,
    });
    check(res.result?.isError === true, `publish refuses: ${what}`);
  }

  const noDefault = await bridge.call("tools/call", {
    name: "publish_to_github",
    arguments: { repo: "acme/mocks" },
  });
  check(
    /no default/i.test(noDefault.result.content[0].text),
    "the refusal tells the agent to ask the user rather than pick",
  );

  console.log("github-smoke: ok");
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
    console.error(`github-smoke: FAILED: ${what}`);
    process.exitCode = 1;
    throw new Error(what);
  }
}
