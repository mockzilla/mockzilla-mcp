# mockzilla-mcp

Stdio MCP server bridging Claude Desktop / Cursor / etc. to mockzilla.
Pure-JS, no build step, ESM, Node ≥ 18.

## Layout

```
bin/cli.js     JSON-RPC entry: stdin loop, dispatch, signal handlers.
lib/tools.js   The local tool registry (descriptions + handler refs).
lib/install.js check_cli, install_cli, resolveMockzilla, cache helpers.
lib/local.js   serve_locally, stop_locally, peek_openapi, child tracking.
lib/discover.js discover_specs (filesystem scan + spec summaries).
lib/docs.js    mockzilla_docs_{topics,read,search}; raw GitHub source +
               MOCKZILLA_DOCS_DIR override for contributors editing docs.
lib/version.js Bridge version + npm registry update check (bridge_status).
lib/proxy.js   Hosted-plane forwarding (uses MOCKZILLA_TOKEN).
lib/util.js    Tiny shared helpers (shellEscape).
```

`bin/cli.js` is the only file the npm bin entry runs. It owns the
JSON-RPC loop and delegates everything else.

## Two planes

- **Local plane.** Tools that touch the user's machine. Defined in
  `lib/tools.js`, handlers live in `lib/install.js` or `lib/local.js`.
  Always available — no auth, no token.
- **Hosted plane.** Tools the Django server defines at
  `app/mcp/tools.py`. Proxied through when `MOCKZILLA_TOKEN` is set.
  When the bridge sees a `tools/call` for a name it doesn't recognise
  locally, it forwards to the hosted endpoint.

Tool names must not collide — local tools always win the dispatch, so a
local tool with the same name as a hosted one would shadow it.

## Adding a new local tool

There's a registry pattern — `lib/tools.js` is the single source of
truth for what the agent sees. The actual handler lives in
`lib/local.js` (or, if it's an install/cache concern, `lib/install.js`).

### 1. Write the handler

Add an `async` function to `lib/local.js`:

```js
export async function describe_thing(args) {
  // Validate args. Throw if invalid; the bridge translates thrown
  // errors into MCP `isError: true` results so the agent surfaces
  // them to the user.
  if (typeof args.target !== "string") {
    throw new Error("`target` must be a string");
  }

  // Do the work. Plain return value becomes the result's JSON text
  // content. Keep it small and structured — the agent reads it.
  return { target: args.target, observed: someState() };
}
```

Conventions for handlers:

- **Throw on bad input.** Don't return `{error: ...}` — throw. The
  dispatcher in `bin/cli.js` already converts thrown errors into MCP
  tool errors with `isError: true`.
- **Validate inputs.** JSON Schema in the registry is advisory only —
  not all clients enforce it. Re-validate types and ranges in the
  handler.
- **No `any` returns.** Return shapes the agent can render. Prefer
  small, named fields over big nested blobs.
- **Long-running ops:** the bridge has a 30s implicit budget per
  tools/call (see `READY_TIMEOUT_MS` in `lib/local.js`). If you need
  longer, surface progress as a follow-up tool — see how
  `serve_locally` + `stop_locally` separate concerns.
- **Side effects:** if the tool writes files, spawns processes, or
  makes network calls, *say so explicitly in the description*. The
  description is the only consent surface the agent has.

### 2. Register it

Add an entry to `LOCAL_TOOLS` in `lib/tools.js`:

```js
import { describe_thing } from "./local.js";

export const LOCAL_TOOLS = {
  // ...existing tools...

  describe_thing: {
    description:
      "One sentence on WHAT it does. One sentence on WHEN to use it " +
      "(especially: prefer it over which other tool, if any). One " +
      "sentence on side effects if any.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string" },
      },
      required: ["target"],
      additionalProperties: false,
    },
    handler: describe_thing,
  },
};
```

The description is what the agent reads to decide whether to call your
tool. Spend time on it. Tell the agent what it's for, when to prefer it
over another tool, what shape of input is valid.

### 3. Smoke-test

There's no test framework yet — smoke-tests are stdio round-trips:

```bash
(cat <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"describe_thing","arguments":{"target":"foo"}}}
EOF
sleep 2) | node bin/cli.js
```

Then restart Claude Desktop and ask the agent something that should
trigger the tool. The agent's choice (or non-choice) is the real test.

## Style

- ESM, no CommonJS.
- No transpilation. Code is shipped as-is.
- No `any`. Validate at the boundary, then trust types.
- No emojis in code or output unless the user asks.
- One short comment line above non-obvious code; explain the WHY, not
  the WHAT. Names should make the WHAT obvious.
- Don't add new dependencies casually. The current dep list is
  intentionally empty (Node builtins only).
- Public exports first, private helpers below — same as the
  mockzilla repo's CLAUDE.md.

## Testing the install flow

`install_cli` writes to `~/.cache/mockzilla-mcp/`. To re-test from a
clean slate: `rm -rf ~/.cache/mockzilla-mcp`. To test the cache
fallback (when system mockzilla isn't on PATH), temporarily move the
binary aside: `mv $(command -v mockzilla){,.bak}` then run; restore
after.

## Adding a hosted tool

Hosted tools are defined in the Django repo at
`app/mcp/tools.py:REGISTRY` — not here. The bridge auto-discovers them
via `tools/list` proxying. When you add one there, restart the bridge
(or Claude Desktop) and the new tool appears in the merged list.

## Versioning

Two version axes, deliberately separate:

- **Bridge version** in `package.json`. This is what users get from
  `npx @mockzilla/mcp@latest`. Bump on every published change.
- **Mockzilla CLI pin** as `MOCKZILLA_VERSION` in `lib/install.js`.
  Bump when the bridge starts depending on a newer CLI flag or
  subcommand. Users can override at runtime with `MOCKZILLA_BIN_VERSION`.

The `bridge_status` tool (`lib/version.js`) reads the bridge version
from `package.json` and compares against `https://registry.npmjs.org/@mockzilla/mcp/latest`.
The agent calls it on demand; the result is cached for 5 minutes to
avoid hammering the registry. Background warming on startup makes the
first call instant.
