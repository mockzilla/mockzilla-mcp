# API keys

An API key lets a script call Mockzilla as your organization. Keys live in Settings on the **API Keys** tab. Owners and admins manage them.

(Image: The API keys list: two live keys and one revoked, with role, prefix, creation and last use.)

*The organization's API keys*

Each row shows the key's role, when it was made and when it was last used. **Prefix** is the first 12 characters of the key, which is the only part we keep.

## Create a key

Press **Create key**, give it a name and pick a role.

(Image: The create dialog, with a name and a role for the new key.)

*Creating a key*

- **Editor** reads and changes simulations.
- **Viewer** reads.

A key never manages members, other keys or billing, whoever created it.

The key itself is shown once, right after you create it. Copy it then and store it somewhere safe. We keep only a hash of it, so a lost key means a new key.

See Roles and permissions (topic `settings/roles-and-permissions`).

## Use a key

Send it as a bearer token:

```bash
curl "https://platform.mockzilla.org/v1/sims/" \
  -H "Authorization: Bearer mz_live_..."
```

The key belongs to one organization and sees that organization's simulations, whoever made it and whatever else they have access to.

What a key does is recorded under the key's name, so a deploy from CI is not filed as somebody's click.

See Audit log (topic `settings/audit-log`).

## Revoke a key

**Revoke** on the row stops the key immediately. Anything still using it starts failing on its next call.

The row stays, marked with the date. The filter above the table switches between active keys, revoked keys and all of them.

## How many you can hold

Your plan sets how many active keys an organization can have. The create dialog tells you when you have reached it, and revoking one frees a place.

Agents you connect over MCP get their own credentials. They are not in this list and do not count against that number.

See MCP server (topic `developer-tools/mcp-server`).
