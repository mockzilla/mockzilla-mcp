# MCP server for AI agents

Mockzilla ships an MCP server, so a coding agent can start mock APIs for you. Ask it to mock a spec and it installs the CLI, starts a server and hands back the URL, without you leaving the editor.

It runs through `npx` and needs Node 18 or newer. Nothing else to install. The local half works with no Mockzilla account at all.

## Add it to your agent

Claude Code:

```bash
claude mcp add -s user mockzilla -- npx -y @mockzilla/mcp@latest
```

Gemini CLI:

```bash
gemini mcp add -s user mockzilla npx -y @mockzilla/mcp@latest
```

Claude Desktop and Cursor take a config file. Claude Desktop's is `~/Library/Application Support/Claude/claude_desktop_config.json`, Cursor's is `~/.cursor/mcp.json`, and both want the same block:

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

Restart the app after editing. Cursor can also do it under **Settings -> MCP Servers -> Add new MCP server**.

Keep `@latest` in the command. Without it `npx` reuses the first version it ever resolved, and a restart never picks up a newer one.

## What your agent can do without an account

Every one of these runs on your own machine:

- **Set up**: `check_cli` looks for the CLI on your machine, `install_cli` fetches it into the bridge's own cache, and `bridge_status` reports whether a newer bridge has been published.
- **Read specs**: `info` summarises a spec or a `.mockz` package with its full path list, `lint` finds schemas no response can satisfy, and `discover_specs` scans a folder and reports what can be mocked from it.
- **Reshape specs**: `simplify` cuts a spec down when it is too heavy to mock cleanly, and `pack` turns a folder of services into a `.mockz` archive.
- **Run mocks**: `serve_locally` starts a server over one or several specs, and can add latency or error responses to one. `stop_locally` stops it, and `call_endpoint` fires a request so the agent can show you the response.
- **Mock without a spec**: `mock_endpoint` pins a single path to a response you describe, with `list_mock_endpoints` and `clear_mock_endpoints` alongside it.
- **Read the docs**: `mockzilla_docs_topics`, `mockzilla_docs_search` and `mockzilla_docs_read` give the agent the docs on this site and the engine docs. They come with the bridge, so reading them needs no internet access and no login.

`install_cli` never edits your `PATH`. It keeps its own copy, so a `brew` install stays untouched.

## Connect your account

Once you log in, the agent also reaches your organization: it can list what you have deployed, browse the catalog, and deploy a hosted simulation that keeps answering after the agent stops.

Ask your agent to log in to Mockzilla, or ask it for something hosted. It calls the `login` tool and your browser opens the Mockzilla sign-in.

Sign in, if you are not already.

(Image: The Mockzilla sign-in page, with the sign-in providers and the email form.)

*The Mockzilla sign-in*

Pick the organization the agent should work in.

(Image: The consent page for Mockzilla MCP, with the organization picker set to Acme Inc.)

*The organization picker*

Choose **Read only** or **Read and write**. Read and write lets the agent deploy. Viewers can only choose Read only.

(Image: The access choice, with Read and write selected over Read only.)

*The access choice*

Click **Allow**.

(Image: The whole consent page, with the Deny and Allow buttons at the bottom.)

*The page, ready to allow*

The hosted tools appear in your agent as soon as you allow it. If they do not show up, start a new session. The login stays on your machine and renews itself, so you only do this once.

More tools appear after you log in:

- **`get_context`** reports which organization and access the agent has.
- **`list_sims`** pages through the simulations you can see, with their URLs and statuses.
- **`list_catalog_products`** browses the catalog.
- **`wait_for_deploy`** waits for a deploy to go active and returns its live URL.
- **`deploy_mock_from_catalog`**, **`deploy_mock_from_spec`** and **`deploy_mock_from_url`** create a hosted simulation from a catalog entry, a pasted spec or a spec URL. Only a Read and write login gets these.

A deploy through an agent is a deploy like any other: it counts against your plan and shows up in the app.

To switch organization or access, ask the agent to log out, which calls `logout`, then log in again. Every app you connected is listed in **Settings**, on the **Connected apps** tab, where you can also revoke one.

## Use an API key instead

A machine without a browser, such as a CI runner or a remote server, cannot open the sign-in page. Give the agent an API key there.

Create the key first. Open **Settings**, then the **API Keys** tab, and click **Create key**. Give it the **Editor** role if the agent should deploy, **Viewer** if it should only read. The key is shown once.

(Image: The create key dialog, with a name for the agent's key and the Editor role picked.)

*A key for the agent*

> API keys are part of plans that include them.

Then pass it as `MOCKZILLA_TOKEN`. In Claude Code:

```bash
claude mcp add -s user mockzilla -e MOCKZILLA_TOKEN=mz_... -- npx -y @mockzilla/mcp@latest
```

In a config file:

```json
{
  "mcpServers": {
    "mockzilla": {
      "command": "npx",
      "args": ["-y", "@mockzilla/mcp@latest"],
      "env": { "MOCKZILLA_TOKEN": "mz_..." }
    }
  }
}
```

With a key set, the hosted tools are there from the start and the agent never asks you to log in.

## Settings

These environment variables are all optional:

- **`MOCKZILLA_TOKEN`** is an API key to use instead of logging in.
- **`MOCKZILLA_NO_BROWSER`** set to `1` stops `login` from opening a browser. The agent gives you the sign-in link instead.
- **`MOCKZILLA_BIN_VERSION`** pins which CLI version `install_cli` fetches. It follows the bridge by default.
- **`MOCKZILLA_MANAGED_PORT`** is the preferred port for the `mock_endpoint` server, `2200` by default. A busy port falls back to a free one.

## Where its files live

The bridge keeps the CLI it installed and the endpoints `mock_endpoint` wrote under `~/.cache/mockzilla-mcp/`. Deleting that folder resets it completely, and a `brew` install of the CLI is not affected.

To wipe only the mocked endpoints, ask the agent to run `clear_mock_endpoints`.

Your login is saved under `~/.config/mockzilla-mcp/`. Logging out deletes it.

## Where to go next

- CLI reference (topic `developer-tools/cli-reference`)
- Start from the catalog (topic `simulations/start-from-the-catalog`)
- Deploy and URLs (topic `simulations/deploy-and-urls`)

The bridge is open source: [mockzilla/mockzilla-mcp](https://github.com/mockzilla/mockzilla-mcp).
