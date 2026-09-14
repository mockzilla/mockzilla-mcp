// Docs tools round-trip against the packaged docs/: every topic in the index is
// readable, a whole category fits in one tool result, and search finds a topic.
// Run via `node scripts/docs-smoke.mjs`.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

// Claude Code's default cap on one tool result is 25k tokens; 4 characters a token is a safe floor.
const RESULT_LIMIT_CHARS = 25_000 * 4;

if (!existsSync("docs/index.json")) {
  console.error("docs-smoke: no docs/ to test. Run `make build` first.");
  process.exit(1);
}

const bridge = startBridge();
try {
  await bridge.call("initialize", { protocolVersion: "2025-06-18" });

  const listed = parse(await bridge.call("tools/call", { name: "mockzilla_docs_topics", arguments: {} }));
  const slugs = listed.categories.map((c) => c.slug);
  check(slugs.includes("getting-started") && slugs.includes("engine"), `product and engine categories (got ${slugs.join(", ")})`);
  const ids = listed.categories.flatMap((c) => c.topics.map((t) => t.id));
  check(listed.categories.every((c) => c.topics.every((t) => t.title && t.summary)), "every topic has a title and summary");

  const seen = new Set();
  for (const slug of slugs) {
    let pending = { category: slug };
    while (pending) {
      const response = await bridge.call("tools/call", { name: "mockzilla_docs_read", arguments: pending });
      const text = response.result.content[0].text;
      check(text.length < RESULT_LIMIT_CHARS, `a read of ${slug} fits one tool result (${text.length} chars)`);
      const read = parse(response);
      for (const topic of read.topics) {
        check(topic.markdown.startsWith(`# ${topic.title}`), `${topic.id} starts with its title`);
        check(!/\]\((?!https?:)[^)]*\)/.test(topic.markdown), `${topic.id} has no relative links left`);
        seen.add(topic.id);
      }
      pending = read.remaining ? { topics: read.remaining } : null;
    }
  }
  check(ids.every((id) => seen.has(id)), `every listed topic was read (${seen.size} of ${ids.length})`);

  const found = parse(
    await bridge.call("tools/call", { name: "mockzilla_docs_search", arguments: { query: "what is a simulation" } }),
  );
  check(found.results.length > 0, "search finds something for 'what is a simulation'");

  const bad = await bridge.call("tools/call", { name: "mockzilla_docs_read", arguments: { topics: ["no/such-topic"] } });
  check(bad.result.isError === true, "an unknown topic is a tool error");

  console.log(`docs-smoke: ok (${ids.length} topics)`);
} finally {
  bridge.stop();
}

function startBridge() {
  const child = spawn(process.execPath, ["bin/cli.js"], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, MOCKZILLA_TOKEN: "", MOCKZILLA_DOCS_DIR: "" },
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
        new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), 10_000)),
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
    console.error(`docs-smoke: FAILED: ${what}`);
    process.exitCode = 1;
    throw new Error(what);
  }
}
