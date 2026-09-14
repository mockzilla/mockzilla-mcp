# CLI reference

The `mockzilla` CLI is the open source mock server. It runs on your machine, needs no account and works offline. This page lists what you can type.

See Install the CLI (topic `getting-started/install-the-cli`) to get it onto your machine.

## Serve a mock

One argument, and what you point it at decides what runs:

```bash
mockzilla petstore.yml                                       # a spec file
mockzilla https://petstore3.swagger.io/api/v3/openapi.json   # a spec by URL
mockzilla ./services/                                        # a folder
mockzilla petstore.mockz                                     # a package, from disk or a URL
mockzilla response.json                                      # one static response, served at GET /
```

The server starts on port 2200 with the API explorer at its root. Files loaded from disk are watched: save a spec, a `config.yml` or a `context.yml` and that service is swapped live, no restart.

A folder is read as a pile of specs, as a single service, or as a `services/` tree.

See Portable simulations (topic `simulations/portable-simulations`) for the three folder shapes and what belongs in each.

## Flags

- **`--port N`** picks the port. `0` takes any free port the machine offers. Defaults to `2200`.
- **`--ready-stamp`** prints a single JSON line once the server is listening, for scripts that wait on it.

Four more apply when exactly one service is registered, which is the case for a single spec file or a single service folder:

- **`--latency D`** delays every response by a duration, like `100ms` or `1s`.
- **`--mount PATH`** sets the URL prefix the service answers on, like `pets/v2`.
- **`--errors RULES`** answers a share of requests with an error status. `p5=500,p10=503` sends 500 to 5 percent of requests and 503 to the next 5.
- **`--context FILE`** points at a context YAML, the flat replacement values that shape generated data.

How much the server logs is an environment variable rather than a flag. `LOG_LEVEL` takes `debug`, `info`, `warn`, `error` or `none`, and defaults to `info`.

## Look inside a spec

```bash
mockzilla info petstore.yml
mockzilla info https://petstore3.swagger.io/api/v3/openapi.json
mockzilla info petstore.mockz
```

Prints one JSON object and exits: title, version, OpenAPI version, endpoint count, and every path with its method and operation id. A `.mockz` package is unpacked and summarised the same way, so you can read what an archive holds before serving it.

## Simplify a spec

```bash
mockzilla simplify openapi.yml
```

Drops optional properties that use `anyOf` or `oneOf`, reduces a required union to its first variant, and strips `x-*` extension fields. Examples are left alone. The result goes to stdout unless `--output` names a file.

Optional properties are cut in one of two ways:

- **`--optional N`** keeps exactly N of them per schema. `--optional 0` drops all of them.
- **`--optional-min A --optional-max B`** keeps a random count in that range. Both flags go together.

Leave both out and every optional property survives. They cannot be combined.

- **`--output FILE`**, or `-o`, writes to a file instead of stdout.
- **`--config FILE`** runs a codegen config first: filter by path, tag or operation id, apply OpenAPI Overlay deltas, then drop the refs those left dangling.

Pass `-` as the spec to read it from stdin:

```bash
curl -s https://example.com/openapi.json | mockzilla simplify -
```

The app does the same job on an uploaded spec, under Spec options.

See Service settings (topic `simulations/service-settings`).

## Pack a folder

```bash
mockzilla pack ./
```

Writes `<folder>.mockz` next to the folder: every service it found, plus a manifest naming each one, its mount and its files. Serve the result with `mockzilla mocks.mockz`, or hand it to someone who will.

- **`--output FILE`**, or `-o`, writes the archive somewhere else.
- **`--name`** and **`--description`** go into the manifest.
- **`--min-version`** records the lowest CLI version that can load the archive.
- **`--skip-git`** leaves out the git remote, ref and commit, which are embedded whenever the folder sits in a git working tree.

This is the archive the GitHub Action packs and uploads on every push.

See GitHub Action (topic `developer-tools/github-action`).

## Codegen projects run themselves

A codegen project compiles its own server. `go build` produces one binary and that binary serves the project, so the CLI has no part in running it. Pointing `mockzilla` at the project folder reads the folder as specs instead.

See Codegen simulations (topic `simulations/codegen-simulations`).

## Run a simulation from your account

A simulation you built in the app runs locally on the same engine. Point the CLI at its share link:

```bash
mockzilla https://mockz.io/fxygibah
```

Its `.mockz` file works the same way, straight from disk and with no network at all. The simulation's **Run locally** view writes both commands out for you, filled in with its own link.

See Run a simulation locally (topic `simulations/run-locally`).

## Version and help

```bash
mockzilla --version
mockzilla --help
mockzilla simplify --help
```

Each subcommand carries its own `--help` with the flags above and their defaults.
