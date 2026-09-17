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

Runs on your machine. No Mockzilla account needed.

From an agent you can:

- Check whether the Mockzilla CLI is installed, and install it into a managed cache (no changes to system PATH).
- Inspect and lint an OpenAPI spec, or scan a folder for specs.
- Simplify a spec that is too heavy to mock, or pack services into a `.mockz` archive.
- Serve any OpenAPI spec locally as a portable mock server, and call its endpoints.
- Mock a single HTTP endpoint without a spec.
- List, stop, and clear locally managed mocks.

### Hosted plane (log in once)

Ask your agent to log in, or ask for something hosted. The agent calls the `login` tool, your browser opens the Mockzilla login, and you pick an organization and read-only or read-and-write access. The bridge keeps the login on your machine and renews it by itself. Hosted tools are listed from the start; before you log in, the agent is told to log in first.

Agents can then:

- List deployed sims.
- Browse catalog products.
- Deploy hosted mocks from a spec, URL, or catalog bundle.
- Wait for a deploy and return the live URL.

Before logging in, only the local plane is exposed. Agents can still help users explore Mockzilla and run local mocks before they sign up.

## Example prompts

You can use these directly from Claude Code, Claude Desktop, Cursor, or Gemini CLI once `mockzilla` is configured as an MCP server.

### Local plane (no account)

- "Is the mockzilla CLI installed on this machine?"
- "Install Mockzilla for me."
- "Spin up the Petstore OpenAPI spec locally so I can curl it."
- "What endpoints does `https://example.com/openapi.yaml` expose?"
- "Mock `POST /checkout` to return a 402 response."
- "List the mock endpoints you're managing."
- "Stop the mock server you started."

### Hosted plane (after logging in)

- "Log me in to Mockzilla."
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

- **`info`**
  Summarise an OpenAPI spec without serving it: `{title, version, openapi_version, endpoint_count, paths}`. Also reads `.mockz` packages.

- **`lint`**
  Find schemas in a spec that no value can satisfy, so a broken spec is caught before serving it: `{clean, defect_count, defects}`.

- **`discover_specs`**
  Scan a directory for OpenAPI specs and folders of static endpoint files. Returns a `suggested_input` for `serve_locally`.

- **`mockzilla_docs_topics`**
  List the Mockzilla docs, by category, with each topic's title and summary. The product docs from mockzilla.org and the engine docs both ship inside the package, so no network or login is needed.

- **`mockzilla_docs_read`**
  Return the full markdown for one or more topics, or a whole category.

- **`mockzilla_docs_search`**
  Keyword search across all docs; returns top sections with snippets.

### Reshaping specs

- **`simplify`**
  Drop or reduce union types, strip `x-*` extensions, and optionally cap optional properties per schema. Writes the simplified spec to disk and returns its path.

- **`pack`**
  Pack a directory of services into a `.mockz` archive that `serve_locally` can serve, even from a URL.

### Local mocking

- **`serve_locally`**
  Start a portable mock server on a free port. Accepts a spec file, directory, or public `https` URL. Returns `{url, port, pid, services}`. For a single spec, `latency`, `errors`, `mount` and `context` add delay, inject error responses, change the mount path, or set replacement values.

- **`stop_locally`**
  Stop a server started by `serve_locally`.

- **`call_endpoint`**
  Make an HTTP request and return `{status, headers, body}`, to show a mock's response. Localhost only unless `allow_remote` is set.

- **`mock_endpoint`**
  Quickly mock a single HTTP endpoint without an OpenAPI spec. Writes a static response into the managed mocks dir and (re)starts the shared server. Takes `status` and `headers` for a failure or a redirect with a real body (404 with an error payload, 201 with a `Location`); omit `response` for a body-less 204 or 304. Needs mockzilla 2.8.20 or newer.

- **`list_mock_endpoints`**
  List all endpoints currently mocked, plus the running server's URL and the Mockzilla UI URL.

- **`clear_mock_endpoints`**
  Wipe all mocks and stop the managed server.

- **`request_history`**
  List the requests the running server answered: method, URL, status, content type, latency, and whether the response came from an upstream. Pass `id` with `service` for one request's full headers and body. Reads the server's own history API, so no account is needed.

- **`diagnose_requests`**
  Explain what is wrong with the recorded traffic and where its data came from: a breakdown by origin, status and content type, latency p50/p95/max, and findings such as an upstream that failed and silently fell back to a generated mock, a 404 from a wrong mount prefix, or a JSON body under a non-JSON content type.

- **`setup_replay`**
  Configure replay for a service: record a response once, then serve it back for every matching request. Returns `recording_scope` saying what each endpoint is keyed by, since with no match fields every call to an endpoint shares one recording. Writes `config.yml` only inside the bridge's own mocks dir; for a folder from your own project it returns the YAML and where it goes.

- **`list_replays`**
  List a service's recordings, with the request values each one is keyed by.

- **`check_github_deployable`**
  Say whether a repository or folder would deploy a mock, and what is missing if not. Knows both kinds: portable service folders and a codegen Go server. Read-only.

- **`list_github_repos`**
  The user's repositories, flagging which already publish mocks, so the agent can ask which one to use.

- **`publish_to_github`**
  Push mocks to one of the user's own repositories and let the Mockzilla action deploy them, giving a URL at `api.mockz.io/gh/<owner>/<repo>/`. No Mockzilla account needed: the first push registers the repository. Merges into an existing services folder rather than replacing it, and never overwrites an existing workflow.

- **`wait_for_github_deploy`**
  Wait for the workflow run and return the live URL.

- **`unpublish_from_github`**
  Take the mocks down and free the simulation slot, optionally deleting the repository too.

### Account

- **`login`**
  Opens the Mockzilla login in the browser, where the user picks an organization and read-only or read-and-write access. Returns right away with the login link. The agent calls a hosted tool again once the user approves. The login is saved under `~/.config/mockzilla-mcp/`, one per server URL, and renewed automatically.

- **`logout`**
  Revokes the connection and deletes the saved login. Log out and in again to switch organization or access.

## Hosted tools

`@mockzilla/mcp` lists the hosted tools from the start and forwards them to `mockzilla.org`'s MCP endpoint once you log in. At the time of writing, the hosted surface includes:

- `get_context`
- `list_sims`
- `list_catalog_products`
- `deploy_mock_from_catalog`
- `deploy_mock_from_spec`
- `deploy_mock_from_url`
- `wait_for_deploy`

Refer to the hosted server's docs or the MCP registry entry for the live tool list.

On a machine without a browser, such as CI or a remote server, set `MOCKZILLA_TOKEN` to an API key from the dashboard instead of logging in. The hosted tools are then available from the start.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `MOCKZILLA_TOKEN` | unset | API key (`mz_*`) to use instead of logging in, for machines without a browser. |
| `MOCKZILLA_MCP_URL` | `https://platform.mockzilla.org/mcp` | Override the hosted endpoint, e.g. `http://localhost:8000/mcp` for local development. |
| `MOCKZILLA_NO_BROWSER` | unset | Set to `1` to not open a browser on `login`; the agent shows the link instead. |
| `MOCKZILLA_MCP_CLIENT_ID` | `https://mockzilla.org/mcp-client.json` | OAuth client id `login` uses. Override only for local development, e.g. with a client registered on a local server. |
| `MOCKZILLA_BIN_VERSION` | matches bridge version | Pin a specific Mockzilla CLI version for `install_cli` to fetch. |
| `MOCKZILLA_MANAGED_PORT` | `2200` | Preferred port for the `mock_endpoint` server. Falls back to a kernel-picked port if busy. Avoid 3000 (Next.js/React), 5173 (Vite), 8080. Try 2400 or 4444 if 2200 is unavailable. |
| `MOCKZILLA_DOCS_DIR` | unset | Read docs from another build of `docs/`, made by `scripts/build.mjs`, instead of the packaged one. |

## Files

The bridge keeps the CLI and mocks under `~/.cache/mockzilla-mcp/`, and the login under `~/.config/mockzilla-mcp/`:

```text
~/.cache/mockzilla-mcp/
├── bin/mockzilla        # downloaded or go-installed binary
├── config.json          # { method, version, invocation? }
└── mocks/               # mock_endpoint persists static endpoints here
    └── services/
        └── <first path segment>/<rest of path>/<method>/
            ├── index.<ext>   # the response body
            └── meta.json     # status and headers, written only when set

~/.config/mockzilla-mcp/
└── credentials.json     # saved logins, one per server URL, readable only by you
```

- `rm -rf ~/.cache/mockzilla-mcp` resets the CLI and all mocked endpoints. The login stays.
- To wipe just the mocks: `rm -rf ~/.cache/mockzilla-mcp/mocks`.
- To drop the login, ask the agent to log out. That also revokes it on mockzilla.org.
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
   - Build `docs/` and `hosted-tools.json` from the published docs bundle, plus the engine docs at the pinned CLI version. Maintainers only: it needs `DOCS_BUNDLE_CMD` in `local.mk`.
   - Run the smoke tests: the stdio round-trip, login against a fake OAuth server, the docs tools, `mock_endpoint` against the real CLI, and the behavior checks that each tool reports only what the server really does (CLI-dependent ones skip when no CLI is installed).
   - `npm publish` the new tarball.
   - Mirror the version into `server.json`.
   - Log `mcp-publisher` in with the GitHub token from Keychain (see below).
   - Run `mcp-publisher publish` against the MCP registry.

3. Commit the `server.json` bump.

If you only want one side:

- `make publish` for npm only.
- `make publish-mcp` for the MCP registry only (`server.json` is always re-synced from `package.json` first).

`mcp-publisher` must be on `PATH` (`brew install mcp-publisher` or follow the [installation docs](https://github.com/modelcontextprotocol/registry)).

### MCP registry login

A registry login lasts 5 minutes, so `make publish-mcp` logs in before every publish. It reads a GitHub token from macOS Keychain, because the browser login (`mcp-publisher login github` without a token) can't publish under `io.github.mockzilla`.

One-time setup:

1. [Create a classic GitHub token](https://github.com/settings/tokens/new?scopes=read:org,read:user&description=mcp-publisher) with `read:org` and `read:user`.
2. Store it in Keychain. The command prompts for the token:

   ```bash
   security add-generic-password -a "$USER" -s mcp-publisher-github -w
   ```

### From GitHub Actions

npm publish from GitHub is disabled for now, so release with `make publish-all`.

`.github/workflows/publish-mcp.yml` runs only when started by hand from the Actions tab. It skips versions the MCP registry already has, waits up to 10 minutes for the version to appear on npm, then publishes `server.json` using GitHub OIDC, so no token is needed.

## Related

- [mockzilla.org](https://mockzilla.org) - hosted API simulation, per-PR mock URLs, GitHub Actions integration
- [mockzilla/mockzilla](https://github.com/mockzilla/mockzilla) - the core open-source API mock server
- [Documentation](https://mockzilla.github.io/mockzilla/) - full usage guide for portable and codegen modes

## License

Copyright © 2026-present

Licensed under the [MIT License](https://github.com/mockzilla/mockzilla-mcp/blob/main/LICENSE)
