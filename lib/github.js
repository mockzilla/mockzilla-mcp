// Publish local mocks to a GitHub repository and let the Mockzilla
// action deploy them. This is the account-free path to a shareable
// URL: the first push from a repository registers it, so nobody has to
// sign up, and `delete: true` frees the slot again.
//
// Everything else in the bridge touches only this machine. These tools
// push the user's content to GitHub and serve it at a public URL, so
// every one of them says so plainly and none of them guesses.

import { exec as execCb } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { briefError, shellEscape } from "./util.js";

const exec = promisify(execCb);

const MOCKS_ROOT = path.join(homedir(), ".cache", "mockzilla-mcp", "mocks");
const WORKFLOW_PATH = ".github/workflows/mockzilla.yml";
const DEPLOY_HOST = "https://api.mockz.io";

// Pushing a file under .github/workflows/ needs this scope. Without it
// git rejects the push with a refspec error that says nothing about
// scopes, so check up front.
const WORKFLOW_SCOPE = "workflow";

// A free-tier runtime gets 128MB. A spec costs far more in memory than
// on disk once it is parsed into models, so a file this size is enough
// to warn about: a deploy that runs out of memory fails without ever
// naming the spec that caused it.
const BIG_SPEC_BYTES = 1_000_000;
const BIG_TOTAL_BYTES = 5_000_000;

function memoryAdvice(entries) {
  const specs = entries.filter(([f]) => /\.(ya?ml|json)$/i.test(f));
  const total = specs.reduce((n, [, size]) => n + size, 0);
  const heavy = specs
    .filter(([, size]) => size >= BIG_SPEC_BYTES)
    .sort((a, b) => b[1] - a[1])
    .map(([f, size]) => `${f} (${(size / 1e6).toFixed(1)}MB)`);
  if (heavy.length === 0 && total < BIG_TOTAL_BYTES) return null;
  return {
    what: heavy.length
      ? `Large spec(s): ${heavy.slice(0, 5).join(", ")}`
      : `${(total / 1e6).toFixed(1)}MB of specs in total`,
    why:
      "A free-tier simulation runs in 128MB, and a spec takes much more " +
      "memory parsed than it does on disk. Too large and the deploy fails " +
      "on memory rather than on anything in the spec.",
    fix:
      "Run `simplify` on the spec first, which drops unions and can cap " +
      "optional properties, then publish the smaller file. Or split the " +
      "services across repositories.",
  };
}

export async function publishToGithub(args = {}) {
  const visibility = args.visibility;
  if (visibility !== "private" && visibility !== "public") {
    throw new Error(
      "`visibility` must be \"private\" or \"public\". There is no default: " +
        "the repository holds whatever the mocks contain, so ask the user " +
        "which they want. Either way the deployed mock URL is public.",
    );
  }
  const repo = parseRepo(args.repo);
  const source = await resolveSource(args.source);

  await assertGh();
  await assertScope(WORKFLOW_SCOPE);

  const existed = await repoExists(repo);
  if (!existed) {
    await run([
      "gh", "repo", "create", repo,
      `--${visibility}`,
      "--description", args.description || "Mock APIs served by Mockzilla",
    ]);
  }

  const work = await mkdtemp(path.join(tmpdir(), "mockzilla-publish-"));
  try {
    await run(["gh", "repo", "clone", repo, work, "--", "--depth", "1"]);

    // Merge by default. An existing repository may already hold
    // services this bridge did not write, and replacing the folder
    // wholesale would delete them without the user ever asking for it.
    const servicesRel = sanitiseRel(args.services_dir || "services");
    const servicesDir = path.join(work, servicesRel);
    const hadServices = await isDir(servicesDir);
    if (args.replace === true) {
      await rm(servicesDir, { recursive: true, force: true });
    }
    await cp(source.services, servicesDir, { recursive: true, force: true });

    // Likewise the workflow: theirs may be customised, and it is the
    // thing that deploys. Only write one when there is none.
    const workflowFile = path.join(work, WORKFLOW_PATH);
    const hadWorkflow = await isFile(workflowFile);
    if (!hadWorkflow) {
      await mkdir(path.join(work, ".github", "workflows"), { recursive: true });
      await writeFile(workflowFile, workflowYaml(servicesRel));
    }
    const teardownReady = hadWorkflow
      ? await fileContains(workflowFile, "workflow_dispatch")
      : true;

    // A codegen repository deploys a built Go server, not service
    // folders. Dropping services/ into one adds files its action never
    // reads and leaves the user wondering why nothing changed.
    if (await isFile(path.join(work, "go.mod"))) {
      if (await isDir(path.join(work, "cmd", "server"))) {
        throw new Error(
          `${repo} is a codegen repository: it has go.mod and cmd/server, so ` +
            "it deploys a built Go server and its action ignores service " +
            "folders. Publishing these mocks there would change nothing. Use " +
            "a different repository for portable mocks, or edit the handlers " +
            "in cmd/server for logic and state.",
        );
      }
    }

    const published = await listFiles(servicesDir);
    const sizeWarning = memoryAdvice(
      await Promise.all(
        published.map(async (f) => [path.relative(work, f), await fileSize(f)]),
      ),
    );
    if (published.length === 0) {
      throw new Error(
        `Nothing to publish: ${source.services} has no service files. ` +
          "Create some with mock_endpoint, or point `source` at a folder " +
          "with a services/ directory.",
      );
    }

    await run(["git", "-C", work, "add", "-A"]);
    const changed = await run(["git", "-C", work, "status", "--porcelain"]);
    if (!changed.trim()) {
      return {
        repo,
        pushed: false,
        mock_url: mockUrl(repo),
        notes:
          "The repository already holds exactly these mocks, so there was " +
          "nothing to push and no new deploy was triggered.",
      };
    }
    await run([
      "git", "-C", work, "-c", "user.name=mockzilla-mcp",
      "-c", "user.email=mcp@mockzilla.org",
      "commit", "-m", args.message || "Publish mocks via mockzilla-mcp",
    ]);
    const branch = (await run(["git", "-C", work, "branch", "--show-current"])).trim();
    await run(["git", "-C", work, "push", "origin", branch]);

    return {
      repo,
      repo_created: !existed,
      visibility: existed ? "unchanged" : visibility,
      branch,
      services_dir: servicesRel,
      pushed: true,
      merged_into_existing_services: hadServices && args.replace !== true,
      workflow: hadWorkflow ? "kept the repository's own" : "added",
      teardown_ready: teardownReady,
      memory_warning: sizeWarning,
      published_files: published.map((f) => path.relative(work, f)),
      mock_url: mockUrl(repo, branch),
      actions_url: `https://github.com/${repo}/actions`,
      next: "Call wait_for_github_deploy to block until the URL answers.",
      notes: [
        `Pushed ${published.length} file(s).`,
        existed
          ? "The repository already existed, so its visibility is unchanged."
          : `Created it as ${visibility}.`,
        hadServices && args.replace !== true
          ? `Files were merged into the existing ${servicesRel}/; same-named ones ` +
            "were overwritten and the rest left alone. Pass replace: true to " +
            "publish only these mocks."
          : null,
        hadWorkflow
          ? "The repository's own workflow was left as it is."
          : null,
        teardownReady
          ? null
          : "That workflow has no workflow_dispatch trigger, so " +
            "unpublish_from_github cannot run it. Add one, or tear down by hand.",
        sizeWarning ? `${sizeWarning.what}. ${sizeWarning.why} ${sizeWarning.fix}` : null,
        "The mock URL is public whatever the repository's visibility, so " +
          "anything in these responses is reachable by anyone with the link.",
        "A first deploy takes a minute or two.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// Clients without a shell cannot run `gh repo list`, so the agent has
// no way to offer the user a choice. This gives it one, and flags the
// repositories already publishing mocks so an existing one is reused
// rather than a second one created beside it.
export async function listGithubRepos(args = {}) {
  await assertGh();
  const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100);
  const raw = await run([
    "gh", "repo", "list",
    ...(args.owner ? [args.owner] : []),
    "--limit", String(limit),
    "--json", "nameWithOwner,visibility,isPrivate,updatedAt,description",
  ]);
  const repos = JSON.parse(raw || "[]");
  const known = await Promise.all(
    repos.map(async (r) => ({
      repo: r.nameWithOwner,
      visibility: (r.visibility || "").toLowerCase(),
      updated_at: r.updatedAt,
      description: r.description || null,
      publishes_mocks: await hasWorkflow(r.nameWithOwner),
    })),
  );
  return {
    count: known.length,
    repos: known,
    notes:
      "Ask the user which repository to publish to; do not pick one for " +
      "them. A repo with publishes_mocks: true already has the Mockzilla " +
      "workflow, so publishing there updates its existing mock rather than " +
      "creating a second one. Any other name creates a new repository.",
  };
}

async function hasWorkflow(repo) {
  return await exec(
    `gh api ${shellEscape(`repos/${repo}/contents/${WORKFLOW_PATH}`)} --silent`,
  ).then(
    () => true,
    () => false,
  );
}

// Answer "would this repository deploy a mock, and if not what is
// missing" without pushing anything. Works against a repository the
// user already has, or a local folder before it becomes one.
export async function checkGithubDeployable(args = {}) {
  const hasRepo = typeof args.repo === "string" && args.repo.length > 0;
  const hasDir = typeof args.dir === "string" && args.dir.length > 0;
  if (hasRepo === hasDir) {
    throw new Error("Pass exactly one of `repo` (\"owner/name\") or `dir`.");
  }

  const paths = [];
  const sizes = new Map();
  let target;
  let workflowText = null;
  if (hasRepo) {
    const repo = parseRepo(args.repo);
    await assertGh();
    target = repo;
    const raw = await run([
      "gh", "api", `repos/${repo}/git/trees/HEAD?recursive=1`,
      "--jq", ".tree[] | select(.type==\"blob\") | \"\\(.size)\\t\\(.path)\"",
    ]).catch((err) => {
      throw new Error(
        `Could not read ${repo}: ${err.message}. Check the name, and that ` +
          "the active gh login can see it.",
      );
    });
    for (const line of raw.split("\n")) {
      const tab = line.indexOf("\t");
      if (tab === -1) continue;
      const file = line.slice(tab + 1).trim();
      if (!file) continue;
      paths.push(file);
      sizes.set(file, Number(line.slice(0, tab)) || 0);
    }
    workflowText = await findMockzillaWorkflow(paths, (p) =>
      run(["gh", "api", `repos/${repo}/contents/${p}`, "--jq", ".content"])
        .then((b64) => Buffer.from(b64.replace(/\s/g, ""), "base64").toString("utf8"))
        .catch(() => null),
    );
  } else {
    const root = path.resolve(args.dir);
    if (!(await isDir(root))) throw new Error(`Not a directory: ${root}`);
    target = root;
    for (const abs of await listFiles(root)) {
      const rel = path.relative(root, abs);
      paths.push(rel);
      sizes.set(rel, await fileSize(abs));
    }
    workflowText = await findMockzillaWorkflow(paths, (p) =>
      readText(path.join(root, p)),
    );
  }

  // Two actions deploy a repository and they want different shapes.
  // Judging a codegen repository by the portable layout would tell the
  // user to add a services/ folder it must not have.
  const codegen = {
    workflow: !!workflowText && /mockzilla\/actions\/codegen/.test(workflowText),
    goMod: paths.includes("go.mod"),
    server: paths.some((p) => p.startsWith("cmd/server/")),
  };
  const isCodegen = codegen.workflow || (codegen.goMod && codegen.server);
  if (isCodegen) {
    return codegenReport({ target, paths, workflowText, codegen, hasRepo, repo: args.repo });
  }

  const servicesRel = servicesDirFrom(workflowText) || "services";
  const serviceFiles = paths.filter(
    (p) => p === servicesRel || p.startsWith(`${servicesRel}/`),
  );
  const services = [
    ...new Set(
      serviceFiles
        .map((p) => p.slice(servicesRel.length + 1).split("/")[0])
        .filter(Boolean),
    ),
  ];

  const problems = [];
  const warnings = [];
  const ok = [];

  if (serviceFiles.length === 0) {
    problems.push({
      what: `No ${servicesRel}/ directory with anything in it`,
      why: "The action publishes the service folders under it; with none there is nothing to deploy.",
      fix: `Add ${servicesRel}/<name>/ holding an OpenAPI spec, or static files like <path>/<method>/index.json.`,
    });
  } else {
    ok.push(`${services.length} service folder(s) under ${servicesRel}/: ${services.join(", ")}`);
    for (const svc of services) {
      const own = serviceFiles.filter((p) => p.startsWith(`${servicesRel}/${svc}/`));
      const hasSpec = own.some((p) => /\.(ya?ml|json)$/i.test(p) && !/\/(config|context|app)\.ya?ml$/i.test(p) && !/\/index\.[^/]+$/i.test(p));
      const hasStatic = own.some((p) => /\/index\.[^/]+$/i.test(p));
      if (!hasSpec && !hasStatic) {
        problems.push({
          what: `Service "${svc}" has neither a spec nor a static endpoint`,
          why: "A service needs an OpenAPI document or at least one <path>/<method>/index.<ext> file.",
          fix: `Add a spec to ${servicesRel}/${svc}/, or a file like ${servicesRel}/${svc}/ping/get/index.json.`,
        });
      }
    }
  }

  if (!workflowText) {
    problems.push({
      what: "No workflow runs mockzilla/actions",
      why: "Nothing deploys without it: the action is what packs the services and registers the repository.",
      fix: `Add ${WORKFLOW_PATH} with the contents in \`workflow_to_add\`.`,
    });
  } else {
    ok.push("A workflow runs mockzilla/actions");
    if (!/token\s*:/.test(workflowText)) {
      problems.push({
        what: "The action step passes no `token`",
        why: "The token is how the action proves which repository the run belongs to. It is required.",
        fix: "Add `token: ${{ secrets.GITHUB_TOKEN }}` under the step's `with:`.",
      });
    }
    if (/pull_request/.test(workflowText) && !/closed/.test(workflowText)) {
      warnings.push({
        what: "pull_request does not list `closed`",
        why: "Closing a pull request should tear its deployment down. Without `closed` the workflow never runs then, so the deployment stays up and keeps counting against the plan.",
        fix: "Use `pull_request:` with `types: [opened, synchronize, reopened, closed]`.",
      });
    }
    if (!/workflow_dispatch/.test(workflowText)) {
      warnings.push({
        what: "No workflow_dispatch trigger",
        why: "The action only removes a repository's mocks on a run with `delete: true`, and push or pull_request triggers cannot supply it. Without a manual trigger there is no way to free the simulation slot.",
        fix: "Add a workflow_dispatch trigger with a boolean `delete` input, as in `workflow_to_add`.",
      });
    }
  }

  const heavy = memoryAdvice(serviceFiles.map((f) => [f, sizes.get(f) || 0]));
  if (heavy) warnings.push(heavy);

  return {
    target,
    services_dir: servicesRel,
    services,
    deployable: problems.length === 0,
    looks_right: ok,
    problems,
    warnings,
    mock_url: hasRepo ? mockUrl(args.repo) : null,
    workflow_to_add: workflowText ? null : workflowYaml(servicesRel),
    notes: [
      problems.length
        ? "`problems` stop it deploying at all."
        : "This deploys as it stands. Push to the default branch, or call " +
          "publish_to_github to add mocks from this machine.",
      warnings.length
        ? "`warnings` still deploy, but cost something later: read each one's `why`."
        : null,
      "Each entry says why it matters and what to change. `workflow_to_add` is " +
        "filled in only when there is no Mockzilla workflow at all; an existing " +
        "one is never rewritten for the user.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

// A repository can hold many workflows; the one that matters is
// whichever runs mockzilla/actions, not whichever sorts first. Check
// the likeliest name before reading the rest.
const WORKFLOW_SCAN_MAX = 12;

async function findMockzillaWorkflow(paths, read) {
  const candidates = paths
    .filter((p) => /^\.github\/workflows\/.+\.ya?ml$/i.test(p))
    .sort((a, b) => Number(b.includes("mockzilla")) - Number(a.includes("mockzilla")))
    .slice(0, WORKFLOW_SCAN_MAX);
  for (const p of candidates) {
    const text = await read(p);
    if (text && /mockzilla\/actions/.test(text)) return text;
  }
  return null;
}

// The codegen action builds ./cmd/server from the repository root and
// deploys the binary, so handlers can hold real logic and state. Its
// requirements are a Go project's, not a folder layout's.
function codegenReport({ target, workflowText, codegen, hasRepo, repo }) {
  const problems = [];
  const warnings = [];
  const ok = [];

  if (codegen.goMod) ok.push("go.mod at the repository root");
  else
    problems.push({
      what: "No go.mod at the repository root",
      why: "The codegen action builds a Go project from the root; without go.mod there is nothing to build.",
      fix: "Run `go mod init <module>` at the root, or start from mockzilla/mockzilla-codegen-template.",
    });

  if (codegen.server) ok.push("a cmd/server package");
  else
    problems.push({
      what: "No cmd/server package",
      why: "The action builds ./cmd/server specifically. Any other entry point is not found.",
      fix: "Move the server's main package to cmd/server/.",
    });

  if (!workflowText) {
    problems.push({
      what: "No workflow runs mockzilla/actions/codegen",
      why: "This repository looks like a codegen project, but nothing deploys it.",
      fix: "Add a workflow using `mockzilla/actions/codegen@v1` with `token: ${{ secrets.GITHUB_TOKEN }}`.",
    });
  } else {
    ok.push("A workflow runs the codegen action");
    if (!/workflow_dispatch/.test(workflowText)) {
      warnings.push({
        what: "No workflow_dispatch trigger",
        why: "Teardown needs a run with `delete: true`, which push and pull_request triggers cannot supply.",
        fix: "Add a workflow_dispatch trigger with a boolean `delete` input.",
      });
    }
  }

  return {
    target,
    mode: "codegen",
    deployable: problems.length === 0,
    looks_right: ok,
    problems,
    warnings,
    mock_url: hasRepo ? mockUrl(repo) : null,
    workflow_to_add: null,
    notes:
      "This is a codegen repository: a Go server whose handlers can hold " +
      "real logic and state, which portable service folders cannot. " +
      "publish_to_github writes portable service folders and would not fit " +
      "here, so deploy this by pushing, and change behaviour in the handlers.",
  };
}

function servicesDirFrom(workflowText) {
  const m = workflowText && workflowText.match(/services-dir\s*:\s*([^\s#]+)/);
  return m ? m[1].replace(/^["']|["']$/g, "") : null;
}

async function readText(p) {
  const { readFile } = await import("node:fs/promises");
  return await readFile(p, "utf8").catch(() => null);
}

export async function waitForGithubDeploy(args = {}) {
  const repo = parseRepo(args.repo);
  const timeoutMs = Math.min(Math.max(Number(args.timeout_seconds) || 300, 30), 900) * 1000;
  await assertGh();

  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const raw = await run([
      "gh", "run", "list", "--repo", repo,
      "--workflow", "mockzilla.yml", "--limit", "1",
      "--json", "status,conclusion,url,headBranch",
    ]).catch(() => "[]");
    const runs = JSON.parse(raw || "[]");
    last = runs[0] || null;
    if (last && last.status === "completed") {
      const url = mockUrl(repo, last.headBranch);
      return {
        repo,
        conclusion: last.conclusion,
        run_url: last.url,
        mock_url: last.conclusion === "success" ? url : null,
        notes:
          last.conclusion === "success"
            ? `Deployed. Call ${url} to try it, or call_endpoint with allow_remote: true.`
            : `The deploy run finished as ${last.conclusion}. Open run_url for the log; ` +
              "a full plan limit and a too-long repository plus branch name are the usual causes.",
      };
    }
    await sleep(5000);
  }
  return {
    repo,
    conclusion: null,
    run_url: last?.url || `https://github.com/${repo}/actions`,
    mock_url: null,
    notes:
      `Still running after ${Math.round(timeoutMs / 1000)}s. Call again to keep waiting, ` +
      "or open run_url.",
  };
}

export async function unpublishFromGithub(args = {}) {
  const repo = parseRepo(args.repo);
  const deleteRepo = args.delete_repo === true;
  await assertGh();

  const dispatched = await run([
    "gh", "workflow", "run", "mockzilla.yml",
    "--repo", repo, "-f", "delete=true",
  ]).then(
    () => true,
    () => false,
  );

  let repoDeleted = false;
  if (deleteRepo) {
    await assertScope("delete_repo");
    await run(["gh", "repo", "delete", repo, "--yes"]);
    repoDeleted = true;
  }

  return {
    repo,
    teardown_dispatched: dispatched,
    repo_deleted: repoDeleted,
    notes: [
      dispatched
        ? "Ran the workflow with delete: true, which removes this repository's " +
          "mocks and frees its simulation slot. It takes a few seconds."
        : "Could not run the teardown workflow. The repository may not have " +
          "the mockzilla.yml this bridge writes, or it has no workflow_dispatch " +
          "trigger. Add `delete: true` to the action and run it, or remove the repo.",
      repoDeleted ? "The repository itself was deleted." : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

// workflow_dispatch with a delete input is what makes teardown
// possible at all: the action only removes a repository's mocks when a
// run passes delete: true, and push/pull_request triggers cannot.
function workflowYaml(servicesRel = "services") {
  const servicesInput =
    servicesRel === "services" ? "" : `\n          services-dir: ${servicesRel}`;
  return `name: mockzilla

# Written by mockzilla-mcp. The workflow_dispatch trigger is what lets
# the mocks be torn down later: the action frees this repository's
# simulation slot only on a run with delete: true.
on:
  push:
    branches: [main, master]
  pull_request:
    types: [opened, synchronize, reopened, closed]
  workflow_dispatch:
    inputs:
      delete:
        description: Remove this repository's mocks instead of publishing
        type: boolean
        default: false

permissions:
  contents: read
  pull-requests: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mockzilla/actions@v1
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
          delete: \${{ inputs.delete || false }}${servicesInput}
`;
}

function sanitiseRel(dir) {
  const rel = String(dir).replace(/^\.\/+/, "").replace(/\/+$/, "");
  if (!rel || path.isAbsolute(rel) || rel.split("/").includes("..")) {
    throw new Error(
      "`services_dir` must be a relative path inside the repository, e.g. " +
        "\"services\" or \"test/mocks\".",
    );
  }
  return rel;
}

function mockUrl(repo, branch) {
  const base = `${DEPLOY_HOST}/gh/${repo}`;
  return branch && branch !== "main" && branch !== "master"
    ? `${base}/${branch}/`
    : `${base}/`;
}

function parseRepo(repo) {
  if (typeof repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(
      "`repo` must be \"owner/name\", e.g. \"acme/checkout-mocks\". It can be " +
        "a repository that already exists or one to create.",
    );
  }
  return repo;
}

// Publish what mock_endpoint built, or a folder the user already has.
async function resolveSource(source) {
  if (source === undefined || source === null || source === "") {
    const services = path.join(MOCKS_ROOT, "services");
    if (!(await isDir(services))) {
      throw new Error(
        "No mocks to publish yet. Create some with mock_endpoint, or pass " +
          "`source` pointing at a folder that holds a services/ directory.",
      );
    }
    return { root: MOCKS_ROOT, services };
  }
  const root = path.resolve(source);
  if (!(await isDir(root))) throw new Error(`Not a directory: ${root}`);
  const nested = path.join(root, "services");
  if (await isDir(nested)) return { root, services: nested };
  return { root: path.dirname(root), services: root };
}

async function assertGh() {
  try {
    await exec("gh --version");
  } catch {
    throw new Error(
      "The GitHub CLI (gh) is not installed, and these tools drive it. " +
        "Install it from https://cli.github.com, then run `gh auth login`.",
    );
  }
  try {
    await exec("gh auth status");
  } catch {
    throw new Error("Not logged in to GitHub. Run `gh auth login` first.");
  }
}

async function assertScope(scope) {
  const status = await exec("gh auth status")
    .then((r) => `${r.stdout || ""}${r.stderr || ""}`)
    .catch(() => "");
  const line = status.split("\n").find((l) => /Token scopes:/i.test(l)) || "";
  if (line.includes(`'${scope}'`)) return;
  throw new Error(
    `The active GitHub login is missing the \`${scope}\` scope` +
      (line ? ` (it has ${line.split(":").slice(1).join(":").trim()})` : "") +
      ". " +
      (scope === WORKFLOW_SCOPE
        ? "Pushing a file under .github/workflows/ needs it, and without it " +
          "git rejects the push with an error that never mentions scopes. "
        : "") +
      `Run \`gh auth refresh -h github.com -s ${scope}\` and try again.`,
  );
}

async function repoExists(repo) {
  return await exec(`gh repo view ${shellEscape(repo)} --json name`).then(
    () => true,
    () => false,
  );
}

async function listFiles(dir) {
  const { readdir } = await import("node:fs/promises");
  const out = [];
  const walk = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) out.push(full);
    }
  };
  await walk(dir);
  return out;
}

async function isDir(p) {
  const s = await stat(p).catch(() => null);
  return !!(s && s.isDirectory());
}

async function fileSize(p) {
  const s = await stat(p).catch(() => null);
  return s ? s.size : 0;
}

async function isFile(p) {
  const s = await stat(p).catch(() => null);
  return !!(s && s.isFile());
}

async function fileContains(p, needle) {
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(p, "utf8").catch(() => "");
  return text.includes(needle);
}

async function run(argv) {
  const cmd = argv.map(shellEscape).join(" ");
  try {
    const { stdout } = await exec(cmd, { maxBuffer: 8 * 1024 * 1024 });
    return stdout || "";
  } catch (err) {
    throw new Error(briefError((err.stderr && err.stderr.trim()) || err.message));
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
