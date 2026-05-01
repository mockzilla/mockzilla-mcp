# @mockzilla/mcp

MCP server for [mockzilla](https://mockzilla.org). Lets agents like
Claude Desktop and Cursor list sims, deploy mocks from the catalog,
and act on a user's behalf via mockzilla's hosted MCP endpoint.

## Install

Get a bearer token from <https://app.mockzilla.org/account/connected-apps>
(creates an OAuth-issued token tied to one org).

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mockzilla": {
      "command": "npx",
      "args": ["-y", "@mockzilla/mcp"],
      "env": {
        "MOCKZILLA_TOKEN": "mz_oauth_prod_..."
      }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mockzilla": {
      "command": "npx",
      "args": ["-y", "@mockzilla/mcp"],
      "env": {
        "MOCKZILLA_TOKEN": "mz_oauth_prod_..."
      }
    }
  }
}
```

## What you can ask

- "List the sims I have deployed in mockzilla."
- "Show me the catalog products available."
- "Deploy a Stripe sandbox for me named `stripe-test`."
- "Create a mock from this OpenAPI URL: <https://example.com/spec.yaml>."

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `MOCKZILLA_TOKEN` | required | Bearer token (`mz_oauth_*` or `mz_*`). |
| `MOCKZILLA_MCP_URL` | `https://app.mockzilla.org/mcp/` | Override for staging or self-hosted. |

## Publishing (maintainers only)

```bash
npm login
npm publish --access public
```

## License

MIT.
