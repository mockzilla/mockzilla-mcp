# Simulations from GitHub

A simulation from GitHub turns a repository into the source of truth: specs, static endpoints and configuration live as files, and every push deploys them. Nothing about the mock changes without a commit behind it, which is the whole point - mocks reviewed like code, with a URL per branch and per pull request.

## From push to URL

Add one step to a workflow:

```yaml
name: mockzilla

on:
  push:
    branches: [main]
  pull_request:

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: mockzilla/actions@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

On every push the action verifies that the workflow really runs in your repository, using the standard `GITHUB_TOKEN` GitHub issues to the run - there is no Mockzilla key to create, and the token is used once against GitHub's API and never stored. Then it uploads the packed content, waits for the deployment, and prints the URL:

- `https://api.mockz.io/gh/{org}/{repo}/` - the default branch
- `https://api.mockz.io/gh/{org}/{repo}/{branch}/` - any other branch, a pull request included, under the name of the branch it comes from

Keep those branch names flat. A branch with a slash in it, like `feature/checkout`, deploys but has no URL of its own, and calls to it are answered by the default branch.

A pull request gets its URL posted as a comment on the PR, so reviewers click straight into the changed mock. Closing it tears that deployment down, as long as the workflow listens for closed pull requests.

## No account required

The first push from a repository registers it: the simulation exists and answers before anyone has signed up. When you want to see it in the app - history, replays, usage - sign in with GitHub and your organization's simulations are there. The app shows a repository-sourced simulation read-only: its content changes through commits, not clicks, though access settings and environment variables stay editable in the app for values that should not live in a workflow file.

## The repository layout

The portable action publishes a folder per service; the layout is the same one every simulation type shares:

```
services/
  petstore/
    openapi.yml        # the spec; any *.yml/yaml/json works
    config.yml         # optional: upstream, latency, errors, mount
    context.yml        # optional: values that shape generated data
    static/
      users/
        get/
          index.json   # GET /petstore/users, pinned by hand
app.yml                # optional: app-wide settings
```

The codegen action deploys a generated Go project from the repository instead, handlers included.

See Portable simulations (topic `simulations/portable-simulations`) for the folder format and Codegen simulations (topic `simulations/codegen-simulations`) for the generated kind.

## What the action accepts

| Input | What it does |
|---|---|
| `token` | The workflow's `GITHUB_TOKEN`; proves repository identity. Required. |
| `region` | A region preference, not an obligation: the first deploy tries it, and if that region has no capacity, the nearest available one is used instead. It has no effect after the first deploy. |
| `environment` | A JSON object of environment variables for the runtime. |
| `host` | Which API host serves the URL. Defaults to the organization's setting, or `api.mockz.io`. |
| `basic-auth-user`, `basic-auth-password` | Credentials for the API explorer UI. Pass the password as a GitHub secret; it is stored hashed and never logged. |
| `allowed-ips` | A JSON array of CIDRs allowed to reach the simulation. Ignored with a warning when the plan allows no IP allowlist. |
| `services-dir` | Where the service folders live. Defaults to `services`. |
| `timeout-minutes` | How long to wait for the deployment before failing the step. Defaults to 5. |
| `delete` | `true` removes the repository's simulations and frees its slot. |

> On plans with a single simulation slot, one repository occupies it. Run the action with delete: true to free the slot before connecting another.

## Open by design

The action is a public repository, so what runs inside your CI is not a black box: read it at [mockzilla/actions](https://github.com/mockzilla/actions). The engine it deploys is the same open source mock server everything else here runs, and the layout it publishes matches the public template.

Start from the template: [mockzilla/mockzilla-portable-template](https://github.com/mockzilla/mockzilla-portable-template)

The full input reference lives with the action, and on its docs page.

See GitHub Action (topic `developer-tools/github-action`).
