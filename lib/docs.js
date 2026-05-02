// mockzilla docs as MCP tools.
//
// Source of truth: raw markdown from github.com/mockzilla/mockzilla
// (the same repo that ships the CLI). The mkdocs render at
// docs.mockzilla.org is for humans; agents get a better deal with the
// source markdown. Local contributors can point MOCKZILLA_DOCS_DIR at
// their on-disk docs/ for instant feedback while editing.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const REPO = process.env.MOCKZILLA_DOCS_REPO || "mockzilla/mockzilla";
const BRANCH = process.env.MOCKZILLA_DOCS_BRANCH || "main";
const LOCAL_DIR = process.env.MOCKZILLA_DOCS_DIR || null;

const TREE_URL = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
const RAW_URL = (file) =>
  `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${file}`;

const TTL_MS = 60 * 60_000; // 1h

let topicsCache = null;
let topicsAt = 0;
const contentCache = new Map(); // topic → { text, at }

export async function topicsList() {
  if (LOCAL_DIR) return await topicsListLocal();

  if (topicsCache && Date.now() - topicsAt < TTL_MS) {
    return { topics: topicsCache, source: "github (cached)" };
  }
  const res = await fetch(TREE_URL);
  if (!res.ok) {
    throw new Error(`GitHub tree fetch failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  const topics = (body.tree || [])
    .filter((e) => e.type === "blob" && e.path.startsWith("docs/") && e.path.endsWith(".md"))
    .map((e) => topicFromPath(e.path))
    .sort();
  topicsCache = topics;
  topicsAt = Date.now();
  return { topics, source: `github://${REPO}@${BRANCH}` };
}

export async function readTopic(args) {
  const topic = args.topic;
  if (typeof topic !== "string" || topic.length === 0) {
    throw new Error("`topic` must be a non-empty string");
  }
  const text = await loadTopicText(topic);
  return { topic, content: text };
}

export async function searchDocs(args) {
  const query = args.query;
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new Error("`query` must be a non-empty string");
  }
  const limit = Math.min(Math.max(parseInt(args.limit, 10) || 5, 1), 20);
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    throw new Error("`query` produced no searchable tokens");
  }

  const { topics } = await topicsList();
  const sections = [];
  for (const topic of topics) {
    let text;
    try {
      text = await loadTopicText(topic);
    } catch {
      continue; // skip unreadable topics
    }
    sections.push(...sectionsOf(topic, text));
  }

  const scored = sections
    .map((s) => ({ ...s, score: scoreSection(s, tokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      topic: s.topic,
      heading: s.heading,
      snippet: snippetForQuery(s.body, tokens),
      score: s.score,
    }));

  return { query, results: scored };
}

async function topicsListLocal() {
  const files = [];
  await walk(LOCAL_DIR, "", files);
  const topics = files
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
  return { topics, source: `local://${LOCAL_DIR}` };
}

async function walk(root, sub, out) {
  const entries = await readdir(path.join(root, sub), { withFileTypes: true });
  for (const e of entries) {
    const rel = sub ? `${sub}/${e.name}` : e.name;
    if (e.isDirectory()) {
      await walk(root, rel, out);
    } else if (e.isFile()) {
      out.push(rel);
    }
  }
}

async function loadTopicText(topic) {
  if (LOCAL_DIR) {
    return await readFile(path.join(LOCAL_DIR, `${topic}.md`), "utf8");
  }
  const cached = contentCache.get(topic);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.text;

  const url = RAW_URL(`docs/${topic}.md`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Topic "${topic}" not found (GitHub returned ${res.status} for ${url})`,
    );
  }
  const text = await res.text();
  contentCache.set(topic, { text, at: Date.now() });
  return text;
}

function topicFromPath(p) {
  return p.replace(/^docs\//, "").replace(/\.md$/, "");
}

// Markdown section parsing — one section per `##` heading. The text
// before the first `##` becomes the "intro" section.
function sectionsOf(topic, text) {
  const lines = text.split("\n");
  const sections = [];
  let current = { topic, heading: "(intro)", body: [] };

  for (const line of lines) {
    const m = line.match(/^##+\s+(.*)$/);
    if (m) {
      if (current.body.length > 0 || current.heading !== "(intro)") {
        sections.push({ ...current, body: current.body.join("\n").trim() });
      }
      current = { topic, heading: m[1].trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.length > 0 || current.heading !== "(intro)") {
    sections.push({ ...current, body: current.body.join("\n").trim() });
  }
  return sections;
}

function tokenize(s) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length > 1);
}

function scoreSection(section, tokens) {
  const topicL = section.topic.toLowerCase();
  const headingL = section.heading.toLowerCase();
  const bodyL = section.body.toLowerCase();
  let score = 0;
  for (const tok of tokens) {
    if (topicL.includes(tok)) score += 2;
    if (headingL.includes(tok)) score += 3;
    score += countOccurrences(bodyL, tok);
  }
  return score;
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

// Best-effort snippet: find the first line that mentions any token and
// return ~3 lines of context. Keeps responses small so the agent can
// page through search results without burning tokens.
function snippetForQuery(body, tokens) {
  const lines = body.split("\n");
  let bestIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (tokens.some((t) => lower.includes(t))) {
      bestIdx = i;
      break;
    }
  }
  const start = Math.max(0, bestIdx - 1);
  const end = Math.min(lines.length, bestIdx + 4);
  const snippet = lines.slice(start, end).join("\n").trim();
  return snippet.length > 600 ? `${snippet.slice(0, 600)}…` : snippet;
}
