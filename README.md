# @mockzilla/mcp

MCP server for [Mockzilla](https://mockzilla.org/) - an open-source API mock server for OpenAPI specifications. Let Claude Code, Claude Desktop, Cursor, or Gemini CLI install Mockzilla, inspect OpenAPI specs, and spin up realistic local mock APIs in seconds. No account required for local use.

Source: [github.com/mockzilla/mockzilla-mcp](https://github.com/mockzilla/mockzilla-mcp)

## Use cases

- **Local API development** - mock any OpenAPI spec without a real backend or sandbox account
- **CI/CD integration testing** - zero external dependencies in your pipeline
- **PSP and payment API mocking** - Stripe, PayPal, Adyen from your editor without test accounts
- **Crypto exchange API mocking** - Binance, Bybit without registered accounts
- **Rate limit protection** - develop against OpenAI, Twilio without burning quota
- **Agentic workflows** - let Claude or Cursor spin up and manage mock servers automatically

## Two planes

`@mockzilla/mcp` exposes two planes of tools to your MCP client.

### Local plane (no account required)

Works entirely on your machine. Nothing leaves the user's box.

From an agent you can:

- Check whether the Mockzilla CLI is installed.
- Install Mockzilla into a managed cache (no changes to system PATH).
- Inspect an OpenAPI spec (title, version, endpoint count, paths).
- Serve any OpenAPI spec locally as a portable mock server.
- Mock a single HTTP endpoint without a spec.
- List, stop, and clear locally managed mocks.

### Hosted plane (requires `MOCKZILLA_TOKEN`)

When `MOCKZILLA_TOKEN` is set, the bridge forwards extra tools to `mockzilla.org`'s MCP endpoint.

Agents can then:

- List deployed sims.
- Browse catalog products.
- Deploy hosted mocks from a spec, URL, or catalog bundle.
- Wait for a deploy and return the live URL.

Without a token, only the local plane is exposed. Agents can still help users explore Mockzilla and run local mocks before they sign up.

## Example prompts

You can use these directly from Claude Code, Claude Desktop, Cursor, or Gemini CLI once `mockzilla` is configured as an MCP server.

### Local plane (no token)

- "Is the mockzilla CLI installed on this machine?"
- "Install Mockzilla for me."
- "Spin up the Petstore OpenAPI spec locally so I can curl it."
- "What endpoints does `https://example.com/openapi.yaml` expose?"
- "Mock `POST /checkout` to return a 402 response."
- "List the mock endpoints you're managing."
- "Stop the mock server you started."

### Hosted plane (with `MOCKZILLA_TOKEN`)

- "List the sims I have deployed."
- "Show me the catalog products."
- "Deploy a Stripe sandbox named `stripe-test` and give me the live URL."
- "Create a hosted mock from this OpenAPI URL on mockzilla.org."

## Install

### Claude Code

One-liner, no config file editing:

```bash
claude mcp add -s user mockzilla -- npx -y @mockzilla/mcp@latest
```

- `-s user` installs for your user account (available in every project).
- Drop `-s user` to scope to the current project only.

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

Restart Claude Desktop after editing.

### Cursor

Easiest: **Settings -> MCP Servers -> Add new MCP server** and fill in:

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

Restart Cursor after editing.

### Gemini CLI

One-liner, no manual JSON editing:

```bash
gemini mcp add -s user mockzilla npx -y @mockzilla/mcp@latest
```

- `-s user` writes to `~/.gemini/settings.json` (available in every project).
- Drop `-s user` (or use `-s project`) to scope to the current directory's `.gemini/settings.json`.

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

Restart the Gemini CLI after editing.

### Why `@latest`?

Without `@latest`, `npx` caches the first resolved version and won't pick up new publishes. Pinning to `@latest` makes `npx` re-check the registry on every spawn, so a Claude / Cursor / Gemini restart is enough to upgrade. Trade-off: ~200 ms extra startup time.

## Local tools

These tools are always available and never leave the user's machine.

### Setup and status

- **`check_cli`**
  Resolve Mockzilla on this machine: system `PATH` -> bridge cache -> `go run` invocation. Returns install options if nothing matches.

- **`install_cli`**
  Install Mockzilla into `~/.cache/mockzilla-mcp/`. Methods: `download` (prebuilt from GitHub releases, default), `go-install`, `go-run`. Never touches system `PATH`.

- **`bridge_status`**
  Report the bridge's version, check npm for newer publishes, and surface upgrade steps.

### OpenAPI exploration and docs

- **`peek_openapi`**
  Summarise an OpenAPI spec without serving it: `{title, version, openapi_version, endpoint_count, paths}`.

- **`mockzilla_docs_topics`**
  List available Mockzilla doc topics.

- **`mockzilla_docs_read`**
  Return the full markdown for one topic.

- **`mockzilla_docs_search`**
  Keyword search across all docs; returns top sections with snippets.

### Local mocking

- **`serve_locally`**
  Start a portable mock server on a free port. Accepts a spec file, directory, or public `https` URL. Returns `{url, port, pid, services}`.

- **`stop_locally`**
  Stop a server started by `serve_locally`.

- **`mock_endpoint`**
  Quickly mock a single HTTP endpoint without an OpenAPI spec. Writes a static response into the managed mocks dir and (re)starts the shared server.

- **`list_mock_endpoints`**
  List all endpoints currently mocked, plus the running server's URL and the Mockzilla UI URL.

- **`clear_mock_endpoints`**
  Wipe all mocks and stop the managed server.

## Hosted tools

When `MOCKZILLA_TOKEN` is set, `@mockzilla/mcp` forwards hosted tools to `mockzilla.org`'s MCP endpoint.

At the time of writing, the hosted surface includes:

- `get_context`
- `list_sims`
- `list_catalog_products`
- `deploy_mock_from_catalog`
- `deploy_mock_from_spec`
- `deploy_mock_from_url`
- `wait_for_deploy`

Refer to the hosted server's docs or the MCP registry entry for the live tool list.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `MOCKZILLA_TOKEN` | unset | Bearer token (`mz_oauth_*` or `mz_*`). Hosted tools are hidden when unset. |
| `MOCKZILLA_MCP_URL` | `https://app.mockzilla.org/mcp/` | Override the hosted endpoint (staging, self-hosted). |
| `MOCKZILLA_BIN_VERSION` | matches bridge version | Pin a specific Mockzilla CLI version for `install_cli` to fetch. |
| `MOCKZILLA_MANAGED_PORT` | `2200` | Preferred port for the `mock_endpoint` server. Falls back to a kernel-picked port if busy. Avoid 3000 (Next.js/React), 5173 (Vite), 8080. Try 2400 or 4444 if 2200 is unavailable. |
| `MOCKZILLA_DOCS_DIR` | unset | Read docs from this local directory instead of GitHub (useful when editing docs). |
| `MOCKZILLA_DOCS_REPO` | `mockzilla/mockzilla` | Override the GitHub repo to fetch docs from. |
| `MOCKZILLA_DOCS_BRANCH` | `main` | Override the branch to fetch docs from. |

## Cache layout

The bridge keeps everything under `~/.cache/mockzilla-mcp/`:

```text
~/.cache/mockzilla-mcp/
├── bin/mockzilla        # downloaded or go-installed binary
├── config.json          # { method, version, invocation? }
└── mocks/               # mock_endpoint persists static endpoints here
    └── static/
        └── <service>/<path>/<method>/index.<ext>
```

- `rm -rf ~/.cache/mockzilla-mcp` fully resets the bridge (binary + all mocked endpoints).
- To wipe just the mocks: `rm -rf ~/.cache/mockzilla-mcp/mocks`.
- The system `PATH` is never touched, so reset doesn't affect a separate `brew` install of Mockzilla.

## Updates

Recommended way to stay current:

1. Pin `@mockzilla/mcp@latest` in your MCP client config so `npx` re-checks the registry on every spawn.
2. Restart Claude Desktop / Cursor / Gemini periodically. That's when the new tarball is fetched.
3. If something seems off, ask the agent: "Run `bridge_status` and tell me if `@mockzilla/mcp` is up to date."

If it's stale, run:

```bash
npx clear-npx-cache @mockzilla/mcp
```

and restart your MCP client.

The Mockzilla CLI version is pinned by the bridge (via `MOCKZILLA_VERSION` in `lib/install.js`). Updating the bridge updates the pin; the next `install_cli` call brings the CLI itself up to date.

## Development

See [CLAUDE.md](https://github.com/mockzilla/mockzilla-mcp/blob/main/CLAUDE.md) for project conventions and a walkthrough of adding a new tool.

## Releasing

The bridge has two registries to keep in sync: npm (`@mockzilla/mcp`) and the MCP registry (`server.json`). Skipping the second one leaves discovery clients pinned to the previous tarball.

1. Bump `version` in `package.json`.
2. Run:

   ```bash
   make publish-all
   ```

   This will:
   - Run the smoke test.
   - `npm publish` the new tarball.
   - Mirror the version into `server.json`.
   - Run `mcp-publisher publish` against the MCP registry.

3. Commit the `server.json` bump.

If you only want one side:

- `make publish` for npm only.
- `make publish-mcp` for the MCP registry only (`server.json` is always re-synced from `package.json` first).

`mcp-publisher` must be on `PATH` (`brew install mcp-publisher` or follow the [installation docs](https://github.com/modelcontextprotocol/registry)).

## Related

- [mockzilla.org](https://mockzilla.org) - hosted API simulation, per-PR mock URLs, GitHub Actions integration
- [mockzilla/mockzilla](https://github.com/mockzilla/mockzilla) - the core open-source API mock server
- [Documentation](https://mockzilla.github.io/mockzilla/) - full usage guide for portable and codegen modes

## License

Copyright © 2023-present

Licensed under the [MIT License](https://github.com/mockzilla/mockzilla-mcp/blob/main/LICENSE)
