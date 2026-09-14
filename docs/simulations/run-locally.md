# Run a simulation locally

Every simulation can run on your own machine, on the same engine that serves it in the cloud, with the same endpoints and behavior. Local runs work offline, fit into CI, and stay entirely on your machine.

Open **Run locally** at the bottom of the simulation's sidebar:

(Image: The simulation sidebar with Run locally at the bottom)

*Run locally in the sidebar*

The view writes every command for you, filled in with your simulation's own link:

(Image: The Run locally view with CLI, Docker and Docker Compose commands for a share URL)

*The Run locally view*

## Two sources to run from

- **Share URL**: the short link from Share links (topic `simulations/share-links`). The commands fetch the package from the URL, so a refreshed link means an updated mock on the next start.
- **Local file**: the downloaded `.mockz` file, run from disk. No network needed at all.

A `.mockz` file is a plain gzipped tar archive of configuration: a manifest, each service's OpenAPI spec with its settings, your static endpoints. No code, nothing executable; unpack it with `tar` and read it if you like.

## CLI

```bash
mockzilla https://mockz.io/fxygibah
```

The mock serves on port 2200 by default; override with `--port`.

If the CLI is not installed yet, the view carries the install commands, and the docs cover them too.

See Install the CLI (topic `getting-started/install-the-cli`).

## Docker

```bash
docker run -p 2200:2200 mockzilla/mockzilla:latest https://mockz.io/fxygibah
```

Same run, no install: the `mockzilla/mockzilla` image carries the engine. Use `-p` to remap the local port. For a `.mockz` file, mount it into the container; the **Local file** mode writes that command for you.

## Docker Compose

The view also writes a `docker-compose.yml` block, so the mock runs alongside the rest of your stack:

```yaml
services:
  mockzilla:
    image: mockzilla/mockzilla:latest
    ports:
      - "2200:2200"
    command: ["api", "https://mockz.io/fxygibah"]
```
