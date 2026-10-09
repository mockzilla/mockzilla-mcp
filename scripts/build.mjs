// Builds what the npm release packs from the published bundle: docs/ (plus the engine docs at the pinned CLI
// version, and the docs of the mockzilla-codegen version that engine embeds) and hosted-tools.json.
// Usage: node scripts/build.mjs <bundle.json> [docs-dir].
// MOCKZILLA_ENGINE_DIR and MOCKZILLA_CODEGEN_DIR read local checkouts instead of downloading them.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { HOSTED_TOOLS_FILE } from "../lib/hosted.js";
import { MOCKZILLA_VERSION } from "../lib/install.js";

const ENGINE_CATEGORY = {
  slug: "engine",
  name: "Engine",
  description:
    "The open-source mockzilla CLI and server: running mocks locally, service and app configuration, contexts, middleware, replay and storage.",
};
const ENGINE_SITE = "https://mockzilla.github.io/mockzilla";
// index.md only includes the repo README, and api/index.md is a placeholder page.
const ENGINE_SKIP = new Set(["index.md", "api/index.md"]);
// fake-list.md opens straight into its list, so there is no sentence to take a summary from.
const ENGINE_SUMMARIES = { "fake-list.md": "Every fake function a context can use to generate a value, such as fake:address.city." };

const CODEGEN_CATEGORY = {
  slug: "codegen",
  name: "Code generation",
  description:
    "mockzilla-codegen, the generator behind `mockzilla generate`: Go models, servers, clients and MCP tools from an OpenAPI spec, written into the user's own project. Not codegen mode, which builds mockzilla services.",
};
const CODEGEN_MODULE = "github.com/mockzilla/mockzilla-codegen";
const CODEGEN_REPO = "https://github.com/mockzilla/mockzilla-codegen";
// These pages open on a sentence too short or too cut off to tell an agent what is in them.
const CODEGEN_SUMMARIES = {
  "docs/config.md": "Every key of codegen.yaml: the spec with its filters and overlays, output files, models, and the server, client and MCP blocks, with their defaults.",
  "docs/getting-started.md": "Installing, the generate command and its flags, checking generated files in CI, and the runtime guard that ties generated code to the runtime version.",
  "docs/server.md": "What a server block generates: the service interface, the HTTP adapter, a router for one of 14 frameworks, and starter files.",
  "docs/templates.md": "Replacing blocks of the generated code with your own Go templates, and writing extra files from them.",
};

const [bundlePath, outArg = "docs"] = process.argv.slice(2);
if (!bundlePath) {
  console.error("usage: node scripts/build.mjs <bundle.json> [docs-dir]");
  process.exit(2);
}

const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
for (const { slug } of [ENGINE_CATEGORY, CODEGEN_CATEGORY]) {
  if (bundle.categories.some((c) => c.slug === slug)) {
    throw new Error(`a product docs category is named "${slug}", which the repo docs use`);
  }
}

const localEngine = process.env.MOCKZILLA_ENGINE_DIR;
const engineRoot = localEngine || (await downloadRepo("mockzilla", MOCKZILLA_VERSION));
const engine = await engineTopics(engineRoot);
const codegenVersion = await embeddedCodegenVersion(engineRoot);
if (!localEngine) await rm(path.dirname(engineRoot), { recursive: true, force: true });

const localCodegen = process.env.MOCKZILLA_CODEGEN_DIR;
const codegenRoot = localCodegen || (await downloadRepo("mockzilla-codegen", codegenVersion));
const codegen = await codegenTopics(codegenRoot, codegenVersion);
if (!localCodegen) await rm(path.dirname(codegenRoot), { recursive: true, force: true });

const sources = [
  ...bundle.topics.map((t) => ({ ...t, repo: null, relativeTo: null })),
  ...engine,
  ...codegen,
];
const idByUrl = new Map(sources.flatMap((t) => [t.url, ...(t.aliases ?? [])].map((u) => [normalizeUrl(u), t.id])));
const idByFile = new Map(sources.filter((t) => t.repo).map((t) => [`${t.repo.name}:${t.relativeTo}`, t.id]));

const topics = sources.map((t) => ({
  meta: { id: t.id, category: t.category, title: t.title, summary: t.summary, url: t.url },
  markdown: forAgents(t.markdown, (target) => resolveLink(target, t, idByUrl, idByFile)),
}));

const out = path.resolve(outArg);
await clearOutDir(out);
for (const { meta, markdown } of topics) {
  const file = path.join(out, `${meta.id}.md`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, markdown.trimEnd() + "\n");
}
const index = {
  engine_version: MOCKZILLA_VERSION,
  codegen_version: codegenVersion,
  categories: [...bundle.categories, ENGINE_CATEGORY, CODEGEN_CATEGORY],
  topics: topics.map((t) => t.meta),
};
await writeFile(path.join(out, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(
  `build: ${bundle.topics.length} product topics, ${engine.length} engine topics (v${MOCKZILLA_VERSION}), ` +
    `${codegen.length} codegen topics (v${codegenVersion}) -> ${out}`,
);

// A bundle without tools still builds; hosted tools then stay hidden until login.
const hostedTools = bundle.tools ?? [];
if (!bundle.tools) console.warn("build: the bundle has no tools, so hosted tools are hidden until login");
await writeFile(HOSTED_TOOLS_FILE, JSON.stringify({ tools: hostedTools }, null, 2) + "\n");
console.log(`build: ${hostedTools.length} hosted tools -> ${HOSTED_TOOLS_FILE}`);

async function downloadRepo(repo, version) {
  const url = `https://codeload.github.com/mockzilla/${repo}/tar.gz/refs/tags/v${version}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${repo} docs download failed: ${res.status} for ${url}`);
  const dir = await mkdtemp(path.join(tmpdir(), `${repo}-`));
  const tar = spawn("tar", ["-xz", "-C", dir], { stdio: ["pipe", "inherit", "inherit"] });
  const exited = new Promise((resolve, reject) => {
    tar.once("error", reject);
    tar.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tar exited ${code}`))));
  });
  await pipeline(Readable.fromWeb(res.body), tar.stdin);
  await exited;
  const [root] = await readdir(dir);
  return path.join(dir, root);
}

async function engineTopics(root) {
  const files = await navFiles(root);
  const topics = [];
  for (const { file, navTitle } of files) {
    if (ENGINE_SKIP.has(file)) continue;
    const page = file.replace(/\.md$/, "");
    let markdown = await inlineSnippets(await readFile(path.join(root, "docs", file), "utf8"), root);
    const title = markdown.match(/^#\s+(.+?)\s*$/m)?.[1];
    if (!title) markdown = `# ${navTitle ?? page}\n\n${markdown.trimStart()}`;
    topics.push({
      id: `${ENGINE_CATEGORY.slug}/${page}`,
      category: ENGINE_CATEGORY.slug,
      title: title ?? navTitle ?? page,
      summary: ENGINE_SUMMARIES[file] ?? summaryOf(markdown),
      url: `${ENGINE_SITE}/${page}/`,
      markdown,
      repo: { name: "mockzilla" },
      relativeTo: `docs/${file}`,
    });
  }
  return topics;
}

// The docs that describe `mockzilla generate` are those of the generator version the engine was built with.
async function embeddedCodegenVersion(root) {
  const goMod = await readFile(path.join(root, "go.mod"), "utf8");
  const version = goMod.match(new RegExp(`^\\s*${CODEGEN_MODULE.replace(/[.]/g, "\\.")}\\s+v(\\S+)`, "m"))?.[1];
  if (!version) throw new Error(`the engine's go.mod does not require ${CODEGEN_MODULE}`);
  return version;
}

// The README is the overview, and every page under docs/ follows it. The site is GitHub itself.
async function codegenTopics(root, version) {
  const repo = { name: "mockzilla-codegen", blob: `${CODEGEN_REPO}/blob/v${version}` };
  const docs = [];
  await walk(path.join(root, "docs"), "", docs);
  const files = ["README.md", ...docs.sort().map((f) => `docs/${f}`)];
  const topics = [];
  for (const file of files) {
    let markdown = await readFile(path.join(root, file), "utf8");
    const isReadme = file === "README.md";
    if (isReadme) markdown = `# mockzilla-codegen\n\n${stripHtmlHeader(markdown)}`;
    const page = isReadme ? "overview" : file.replace(/^docs\//, "").replace(/\.md$/, "");
    const title = titleLine(markdown);
    if (!title) throw new Error(`${file} has no title`);
    topics.push({
      id: `${CODEGEN_CATEGORY.slug}/${page}`,
      category: CODEGEN_CATEGORY.slug,
      title,
      summary: CODEGEN_SUMMARIES[file] ?? summaryOf(markdown),
      url: isReadme ? CODEGEN_REPO : `${repo.blob}/${file}`,
      aliases: isReadme ? [] : [`${CODEGEN_REPO}/blob/main/${file}`],
      markdown,
      repo,
      relativeTo: file,
    });
  }
  return topics;
}

// A README opens with a centered logo and badges, all HTML, that mean nothing to an agent.
function stripHtmlHeader(markdown) {
  let rest = markdown.trimStart();
  for (;;) {
    const block = rest.match(/^<(h1|div|p)\b[^>]*>[\s\S]*?<\/\1>\s*/);
    if (!block) return rest;
    rest = rest.slice(block[0].length);
  }
}

// Nav order from mkdocs.yml, then any page the nav left out.
async function navFiles(root) {
  const lines = (await readFile(path.join(root, "mkdocs.yml"), "utf8")).split("\n");
  const start = lines.findIndex((l) => l.startsWith("nav:"));
  const titles = new Map();
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const m = line.match(/^\s*-\s*['"]?([^'":]+?)['"]?\s*:\s*['"]?([^'"\s]+\.md)['"]?\s*$/);
    if (m && !titles.has(m[2])) titles.set(m[2], m[1]);
  }
  const all = [];
  await walk(path.join(root, "docs"), "", all);
  const ordered = [...titles.keys()].filter((f) => all.includes(f));
  return [...ordered, ...all.filter((f) => !titles.has(f)).sort()].map((file) => ({ file, navTitle: titles.get(file) }));
}

async function walk(dir, sub, out) {
  for (const entry of await readdir(path.join(dir, sub), { withFileTypes: true })) {
    const rel = sub ? `${sub}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(dir, rel, out);
    else if (rel.endsWith(".md")) out.push(rel);
  }
}

// Mirrors the pymdownx.snippets settings in mkdocs.yml: base paths "." and "examples", "file:section" markers.
async function inlineSnippets(markdown, root) {
  const out = [];
  for (const line of markdown.split("\n")) {
    const m = line.match(/^([ \t]*)--8<--\s+"([^"]+)"\s*$/);
    if (!m) {
      out.push(line);
      continue;
    }
    const [file, section] = m[2].split(":");
    const found = [root, path.join(root, "examples")].map((base) => path.join(base, file)).find(existsSync);
    if (!found) throw new Error(`snippet not found: ${m[2]}`);
    let body = (await readFile(found, "utf8")).split("\n");
    if (section) {
      const from = body.findIndex((l) => l.includes(`--8<-- [start:${section}]`));
      const to = body.findIndex((l) => l.includes(`--8<-- [end:${section}]`));
      if (from === -1 || to === -1) throw new Error(`snippet section not found: ${m[2]}`);
      body = dedent(body.slice(from + 1, to));
    }
    out.push(...body.map((l) => (l ? m[1] + l : l)));
  }
  return out.join("\n");
}

function dedent(lines) {
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(cut));
}

function summaryOf(markdown) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^#\s/.test(l)) + 1;
  const paragraph = [];
  let fence = null;
  for (const line of lines.slice(start)) {
    const marker = line.match(/^[ \t]*(```|~~~)/)?.[1];
    if (fence || marker) {
      if (paragraph.length) break;
      if (!fence) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (!line.trim()) {
      if (paragraph.length) break;
      continue;
    }
    if (/^(#|\||!|-|\*|>|\d+\.)/.test(line.trim())) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line.trim());
  }
  if (!paragraph.length) throw new Error(`no summary sentence in "${titleLine(markdown)}"; add one to ENGINE_SUMMARIES`);
  const text = paragraph.join(" ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const sentence = text.match(/^(.+?[.!?])(\s|$)/)?.[1] ?? text;
  return sentence.length > 240 ? `${sentence.slice(0, 237)}...` : sentence;
}

function titleLine(markdown) {
  return markdown.match(/^#\s+(.+?)\s*$/m)?.[1] ?? "";
}

// Nothing left in a topic should send the agent off to fetch a URL, which is a permission prompt each time.
function forAgents(markdown, resolve) {
  const inline = /(`+)[^`]*?\1|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const rewrite = (text) =>
    text.replace(inline, (match, ticks, alt, image, label, target) => {
      if (ticks) return match;
      if (image !== undefined) return alt ? `(Image: ${alt})` : "";
      const { id, url } = resolve(target);
      if (id) return `${label} (topic \`${id}\`)`;
      if (url) return `[${label}](${url})`;
      return target.startsWith("#") ? label : match;
    });

  // Prose is rewritten a block at a time, since a link label can wrap onto the next line.
  const out = [];
  let prose = [];
  let fence = null;
  for (const line of markdown.split("\n")) {
    const marker = line.match(/^[ \t]*(```|~~~)/)?.[1];
    if (fence) {
      out.push(line);
      if (marker === fence) fence = null;
      continue;
    }
    if (marker) {
      if (prose.length) out.push(rewrite(prose.join("\n")));
      prose = [];
      fence = marker;
      out.push(line);
      continue;
    }
    prose.push(line);
  }
  if (prose.length) out.push(rewrite(prose.join("\n")));
  return out.join("\n");
}

// A link to another topic becomes its id. A relative link to any other file of a repo on GitHub becomes
// its absolute URL there, since a path means nothing outside the checkout.
function resolveLink(target, topic, idByUrl, idByFile) {
  if (/^https?:\/\//.test(target)) return { id: idByUrl.get(normalizeUrl(target)) ?? null };
  if (!topic.repo || target.startsWith("#") || /^[a-z]+:/i.test(target)) return { id: null };
  const [file, anchor] = target.split("#");
  const repoPath = path.posix.normalize(path.posix.join(path.posix.dirname(topic.relativeTo), file));
  const id = idByFile.get(`${topic.repo.name}:${repoPath}`);
  if (id) return { id };
  if (!topic.repo.blob) return { id: null };
  return { id: null, url: `${topic.repo.blob}/${repoPath}${anchor ? `#${anchor}` : ""}` };
}

function normalizeUrl(url) {
  return url.replace(/[#?].*$/, "").replace(/\/+$/, "");
}

// A wrong out-dir must not take anything else with it.
async function clearOutDir(dir) {
  if (existsSync(dir)) {
    const entries = await readdir(dir);
    if (entries.length && !entries.includes("index.json")) {
      throw new Error(`${dir} is not empty and holds no index.json; refusing to replace it`);
    }
    await rm(dir, { recursive: true, force: true });
  }
  await mkdir(dir, { recursive: true });
}
