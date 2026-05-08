# @mockzilla/mcp

MCP server for [Mockzilla](https://mockzilla.org/) - an open-source API simulation platform. Serve realistic mock APIs from any OpenAPI spec locally in seconds, directly from Claude Code, Claude Desktop, Cursor, or Gemini CLI. No account required for local use.

Source: [github.com/mockzilla/mockzilla-mcp](https://github.com/mockzilla/mockzilla-mcp)

The bridge exposes two planes of tools:

- **Local plane (no account):** check whether the mockzilla CLI is
  installed, install it for the user (prebuilt binary, `go install`, or
  `go run`), peek at an OpenAPI spec, and run portable mock servers
  locally. Nothing leaves the user's machine.
- **Hosted plane (with account):** proxied to mockzilla.org's MCP
  endpoint when `MOCKZILLA_TOKEN` is set. List sims, deploy bundles
  from the catalog, etc.

Without a token, the local plane is the entire surface - agents can
still help users explore mockzilla before they sign up.

## Install

### Claude Code

One-liner, no config editing:

```
claude mcp add -s user mockzilla -- npx -y @mockzilla/mcp@latest
```

`-s user` installs it for your user account (available in every project). Drop `-s user` to scope to the current project only.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mockzilla": {
      "command": "npx",
      "args": ["-y", "@mockzilla/mcp@latest"]
    }
  }
}
```

### Cursor

Easiest: **Cursor Settings → MCP Servers → Add new MCP server**, fill in:

- Name: `mockzilla`
- Command: `npx`
- Args: `-y @mockzilla/mcp@latest`

Or edit `~/.cursor/mcp.json` directly:

```json
{
  "mcpServers": {
    "mockzilla": {
      "command": "npx",
      "args": ["-y", "@mockzilla/mcp@latest"]
    }
  }
}
```

### Gemini CLI

One-liner, no config editing:

```
gemini mcp add -s user mockzilla npx -y @mockzilla/mcp@latest
```

`-s user` writes to `~/.gemini/settings.json` (available in every project). Drop `-s user` (or use `-s project`) to scope to the current directory's `.gemini/settings.json`.

Or edit the settings file directly:

```json
{
  "mcpServers": {
    "mockzilla": {
      "command": "npx",
      "args": ["-y", "@mockzilla/mcp@latest"]
    }
  }
}
```

Restart the client after editing config.

> **Why `@latest`?** Without it, npx caches the first resolved version
> and won't pick up new publishes. Pinning to `@latest` makes npx
> re-check the registry on every spawn, so a Claude Desktop / Cursor
> restart is enough to upgrade. Tradeoff: ~200ms extra startup.

## What you can ask

**Without a token (local plane):**

- "Is the mockzilla CLI installed?"
- "Install mockzilla for me." (agent will ask: download / go-install / go-run)
- "Spin up the petstore spec locally so I can curl it."
- "What endpoints does <https://example.com/openapi.yaml> have?"
- "Stop the mock you started."

**With a token (hosted plane added):**

- "List the sims I have deployed."
- "Show me the catalog products."
- "Deploy a Stripe sandbox named `stripe-test` and wait for the live URL."
- "Create a mock from this OpenAPI URL on mockzilla."

## Tools

### Local

| Tool | Purpose |
| --- | --- |
| `check_cli` | Resolve mockzilla on this machine: system PATH → bridge cache → `go run` invocation. Returns install options if nothing matches. |
| `install_cli` | Install mockzilla into `~/.cache/mockzilla-mcp/`. Methods: `download` (prebuilt from GitHub releases, default), `go-install`, `go-run`. Never touches system PATH. |
| `serve_locally` | Start a portable mock server on a free port. Accepts a spec file, directory, or public https URL. Returns `{url, port, pid, services}`. |
| `stop_locally` | Stop a server started by `serve_locally`. |
| `peek_openapi` | Summarise a spec without serving it: `{title, version, openapi_version, endpoint_count, paths}`. |
| `mock_endpoint` | Quickly mock a single HTTP endpoint without an OpenAPI spec. Writes a static response into the managed mocks dir and (re)starts the shared server. |
| `list_mock_endpoints` | List all endpoints currently mocked, plus the running server's URL and the mockzilla UI URL. |
| `clear_mock_endpoints` | Wipe all mocks and stop the managed server. |
| `bridge_status` | Report the bridge's own version, check npm for newer publishes, and surface upgrade steps. |
| `mockzilla_docs_topics` | List the available mockzilla doc topics. |
| `mockzilla_docs_read` | Return the full markdown for one topic. |
| `mockzilla_docs_search` | Keyword search across all docs; returns top sections with snippets. |

### Hosted

Available when `MOCKZILLA_TOKEN` is set. Forwarded to mockzilla.org. See
the hosted server's docs for the live tool list - at the time of writing
it includes `get_context`, `list_sims`, `list_catalog_products`,
`deploy_mock_from_{catalog,spec,url}`, and `wait_for_deploy`.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `MOCKZILLA_TOKEN` | unset | Bearer token (`mz_oauth_*` or `mz_*`). Hosted tools are hidden when unset. |
| `MOCKZILLA_MCP_URL` | `https://app.mockzilla.org/mcp/` | Override the hosted endpoint (staging, self-hosted). |
| `MOCKZILLA_BIN_VERSION` | matches bridge version | Pin a specific mockzilla CLI version for `install_cli` to fetch. |
| `MOCKZILLA_MANAGED_PORT` | `2200` | Preferred port for the `mock_endpoint` server (mockzilla's standard). Falls back to a kernel-picked port if busy. Pick something out of the way - avoid 3000 (Next.js/React), 5173 (Vite), 8080. Try 2400 or 4444 if 2200 is unavailable. |
| `MOCKZILLA_DOCS_DIR` | unset | Read docs from this local directory instead of fetching from GitHub. Useful when editing docs and wanting instant feedback. |
| `MOCKZILLA_DOCS_REPO` | `mockzilla/mockzilla` | Override the GitHub repo to fetch docs from. |
| `MOCKZILLA_DOCS_BRANCH` | `main` | Override the branch to fetch docs from. |

## Cache

The bridge keeps everything under `~/.cache/mockzilla-mcp/`:

```
~/.cache/mockzilla-mcp/
├── bin/mockzilla        # downloaded or go-installed binary
├── config.json          # {method, version, invocation?}
└── mocks/               # mock_endpoint persists static endpoints here
    └── static/
        └── <service>/<path>/<method>/index.<ext>
```

`rm -rf ~/.cache/mockzilla-mcp` resets the bridge fully (binary + all mocked endpoints). To wipe just the mocks: `rm -rf ~/.cache/mockzilla-mcp/mocks`. The system PATH
is never touched, so reset doesn't affect a separate brew install.

## Updates

The bridge ships frequently; recommended way to stay current:

1. Pin `@mockzilla/mcp@latest` in your MCP client config (see install
   snippets above) so npx re-checks the registry on every spawn.
2. Restart Claude Desktop / Cursor periodically - that's when the new
   version is fetched.
3. If something breaks, ask the agent: *"Run `bridge_status` and tell
   me if mockzilla-mcp is up to date."* If it's stale, run
   `npx clear-npx-cache @mockzilla/mcp` and restart your client.

The mockzilla CLI version is pinned by the bridge (`MOCKZILLA_VERSION`
in `lib/install.js`). Updating the bridge updates the pin; the next
`install_cli` call brings the CLI itself up to date.

## Development

See [`CLAUDE.md`](./CLAUDE.md) for project conventions and a walkthrough
of adding a new tool.

## Releasing

The bridge has two registries to keep in lockstep: npm (`@mockzilla/mcp`)
and the MCP registry (`server.json`). Skipping the second one leaves
discovery clients pinned to the previous tarball.

1. Bump `version` in `package.json`.
2. `make publish-all` — runs the smoke test, `npm publish`s the new
   tarball, mirrors the version into `server.json`, then runs
   `mcp-publisher publish`.
3. Commit the `server.json` bump.

If you only want one side: `make publish` for npm only, `make publish-mcp`
for the MCP registry only. `make publish-mcp` always re-syncs
`server.json` from `package.json` first, so the registry record can't
drift below the npm version.

`mcp-publisher` must be on `PATH` (`brew install mcp-publisher` or
follow the [installation docs](https://github.com/modelcontextprotocol/registry)).

## License

MIT.
