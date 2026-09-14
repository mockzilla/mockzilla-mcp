// mockzilla docs as MCP tools. The docs ship inside the package (docs/, built by
// scripts/sync-docs.mjs), so answering from them needs no network and no login.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_DIR = process.env.MOCKZILLA_DOCS_DIR || fileURLToPath(new URL("../docs/", import.meta.url));

// Claude Code cuts a tool result off at 25k tokens; this keeps a read near 15k.
const READ_BUDGET_CHARS = 60_000;

const STOPWORDS = new Set(
  "a an and are can do does for how i in is it me my of on or the to what when where which who why with you".split(" "),
);
// A long section repeating a word should not outrank a title that names it.
const BODY_HITS_CAP = 5;

let loading = null;

export async function topicsList() {
  const docs = await loadDocs();
  return {
    categories: docs.categories.map((category) => ({
      ...category,
      topics: docs.topics
        .filter((t) => t.category === category.slug)
        .map(({ id, title, summary }) => ({ id, title, summary })),
    })),
  };
}

export async function readTopics(args) {
  const docs = await loadDocs();
  const { topics, category } = args;
  if ((topics === undefined) === (category === undefined)) {
    throw new Error("Pass either `topics` or `category`");
  }

  let wanted;
  if (category !== undefined) {
    if (typeof category !== "string" || !docs.categories.some((c) => c.slug === category)) {
      throw new Error(`Unknown category "${category}". Call mockzilla_docs_topics for the list.`);
    }
    wanted = docs.topics.filter((t) => t.category === category);
  } else {
    if (!Array.isArray(topics) || topics.length === 0 || !topics.every((t) => typeof t === "string")) {
      throw new Error("`topics` must be a non-empty array of topic ids");
    }
    const unknown = topics.filter((id) => !docs.byId.has(id));
    if (unknown.length) {
      throw new Error(`Unknown topic ${unknown.join(", ")}. Call mockzilla_docs_topics for the list.`);
    }
    wanted = [...new Set(topics)].map((id) => docs.byId.get(id));
  }

  const result = [];
  const remaining = [];
  let size = 0;
  for (const topic of wanted) {
    if (result.length && size + topic.markdown.length > READ_BUDGET_CHARS) {
      remaining.push(topic.id);
      continue;
    }
    size += topic.markdown.length;
    result.push({ id: topic.id, title: topic.title, url: topic.url, markdown: topic.markdown });
  }
  return remaining.length ? { topics: result, remaining } : { topics: result };
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

  const docs = await loadDocs();
  const results = docs.topics
    .flatMap((topic) => sectionsOf(topic))
    .map((s) => ({ ...s, score: scoreSection(s, tokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      topic: s.topic.id,
      title: s.topic.title,
      heading: s.heading,
      snippet: snippetForQuery(s.body, tokens),
      score: s.score,
    }));

  return { query, results };
}

// Every file at once on first use, then from memory for the life of the process.
function loadDocs() {
  loading ??= (async () => {
    const index = JSON.parse(await readFile(path.join(DOCS_DIR, "index.json"), "utf8"));
    const topics = await Promise.all(
      index.topics.map(async (meta) => ({
        ...meta,
        markdown: await readFile(path.join(DOCS_DIR, `${meta.id}.md`), "utf8"),
      })),
    );
    return { categories: index.categories, topics, byId: new Map(topics.map((t) => [t.id, t])) };
  })().catch((err) => {
    loading = null;
    throw new Error(`Docs not readable from ${DOCS_DIR}: ${err.message}`);
  });
  return loading;
}

// One section per `##` or `###` heading. The text before the first one becomes "(intro)".
function sectionsOf(topic) {
  const sections = [];
  let current = { topic, heading: "(intro)", body: [] };
  for (const line of topic.markdown.split("\n")) {
    const m = line.match(/^#{2,3}\s+(.*)$/);
    if (m) {
      sections.push(current);
      current = { topic, heading: m[1].trim(), body: [] };
    } else if (!/^#\s/.test(line)) {
      current.body.push(line);
    }
  }
  sections.push(current);
  return sections
    .map((s) => ({ ...s, body: s.body.join("\n").trim() }))
    .filter((s) => s.body || s.heading !== "(intro)");
}

function tokenize(s) {
  const words = s
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length > 1);
  const meaningful = words.filter((t) => !STOPWORDS.has(t));
  return meaningful.length ? meaningful : words;
}

function scoreSection(section, tokens) {
  const idL = section.topic.id.toLowerCase();
  const titleL = section.topic.title.toLowerCase();
  const headingL = section.heading.toLowerCase();
  const bodyL = section.body.toLowerCase();
  let score = 0;
  for (const tok of tokens) {
    const word = new RegExp(`(^|[^a-z0-9])${tok.replace(/[-_]/g, "\\$&")}`, "g");
    if (idL.includes(tok)) score += 2;
    if (word.test(titleL)) score += 4;
    word.lastIndex = 0;
    if (word.test(headingL)) score += 3;
    score += Math.min((bodyL.match(word) || []).length, BODY_HITS_CAP);
  }
  return score;
}

// First line that mentions a token, with a little context, so a result list stays small.
function snippetForQuery(body, tokens) {
  const lines = body.split("\n");
  const hit = lines.findIndex((line) => tokens.some((t) => line.toLowerCase().includes(t)));
  const at = Math.max(hit, 0);
  const snippet = lines
    .slice(Math.max(0, at - 1), at + 4)
    .join("\n")
    .trim();
  return snippet.length > 600 ? `${snippet.slice(0, 600)}…` : snippet;
}
