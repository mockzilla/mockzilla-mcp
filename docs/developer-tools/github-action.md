# GitHub Action

Two actions publish a repository to Mockzilla. Both take the same inputs, both end with a live URL, and both are one step in a workflow you already have.

- **`mockzilla/actions@v1`** packs the service folders in your repository and uploads them.
- **`mockzilla/actions/codegen@v1`** builds the repository's Go server and uploads the binary. It needs a `go.mod` at the root and a `cmd/server` package.

See Simulations from GitHub (topic `simulations/github-simulations`) for what a repository-backed simulation is and how the first push registers it.

## The workflow

```yaml
name: mockzilla

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]

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

Swap `portable@v1` for `codegen@v1` and the rest stays as it is.

Both permissions earn their place. `contents: read` is for the checkout. `pull-requests: write` lets the action post the URL on the pull request.

> List `closed` under types, as above. A workflow that says only `pull_request:` never runs when a pull request closes, so its deployment stays up instead of being torn down.

## Inputs

| Input | What it does |
|---|---|
| `token` | Required. The workflow's `GITHUB_TOKEN`. It proves which repository the run belongs to. |
| `region` | A preference for the first deploy. If that region is full, the nearest available one is used. It has no effect once the simulation exists. |
| `environment` | A JSON object of environment variables for the runtime. |
| `host` | Which API host serves the URL. Defaults to the organization's setting, or `api.mockz.io`. |
| `basic-auth-user`, `basic-auth-password` | Credentials for the API explorer. Pass the password as a repository secret; it is stored hashed and never logged. |
| `allowed-ips` | A JSON array of CIDRs allowed to reach the simulation, like `["203.0.113.0/24"]`. Needs a plan that allows an IP allowlist. |
| `timeout-minutes` | How long to wait for the deployment before failing the step. Defaults to `5`. |
| `delete` | `true` removes this repository's simulations. |
| `services-dir` | Portable only. Where the service folders live. Defaults to `services`. |

Credentials and the allowlist are the same settings the app carries.

> Not every plan allows an IP allowlist. Where yours does not, `allowed-ips` is ignored: the run says so and the deploy continues, so the simulation answers everyone.

See Access control (topic `simulations/access-control`).

## What the run gives back

The step waits for the deployment, checking every 15 seconds, and reports in four places:

- **The `url` output**, for later steps in the same job.
- **The job summary**, one line with the live URL.
- **A comment on the pull request**, edited in place on every later push, so the thread keeps one comment instead of collecting one per run.
- **Annotations** for anything non-fatal, the ignored allowlist above included.

Read the URL from a later step through the output:

```yaml
- uses: mockzilla/actions@v1
  id: mockzilla
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
- run: curl -sf "${{ steps.mockzilla.outputs.url }}/petstore/pets"
```

## One URL per branch

Where a push lands depends on the branch it came from:

- **The default branch** answers at `https://api.mockz.io/gh/{org}/{repo}/`.
- **Any other branch** answers at `https://api.mockz.io/gh/{org}/{repo}/{branch}/`.
- **A pull request** answers under its source branch name, the same address that branch already uses.

> Keep branch names flat. A branch called `feature/checkout` deploys, but calls to its URL are answered by the default branch instead of by it.

Closing a pull request tears its deployment down. Branch deployments count against your plan while they exist, so a workflow that listens for `closed` keeps that number honest.

See Usage and limits (topic `simulations/usage-and-limits`).

## Remove a repository

```yaml
- uses: mockzilla/actions@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    delete: true
```

The step skips publishing and removes every mock API this repository has. Run it from a manual `workflow_dispatch` workflow when you want the repository disconnected, or to free a simulation slot for a different repository.

## When a run fails

The step fails with a message, and on a pull request that message is posted as a comment. What you will see:

- **A limit is full.** Simulations, branch deployments, storage, the monthly build allowance or the monthly data transfer. Each names which one and links to your plan.
- **The repository and branch names are too long together.** Shorten either one and push again.
- **`environment` was refused.** It has to be a JSON object with string keys and values, and a few names are reserved by the runtime. The message names what it rejected.
- **The deployment did not become active in time.** Raise `timeout-minutes` above the default of 5.
- **No `go.mod` at the repository root**, on the codegen action. It builds `./cmd/server` from the repository root and stops when there is nothing to build.

## Where to go next

- Simulations from GitHub (topic `simulations/github-simulations`)
- Portable simulations (topic `simulations/portable-simulations`)
- Codegen simulations (topic `simulations/codegen-simulations`)

The actions are a public repository, so what runs in your CI is readable: [mockzilla/actions](https://github.com/mockzilla/actions).
