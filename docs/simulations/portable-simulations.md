# Portable simulations

A portable simulation is the packed form of a mock: the whole simulation - specs, static endpoints, configuration, contexts - as plain files. Portable means the pack travels: the same files serve on your laptop, in Docker, inside CI and hosted on the platform, and nothing stops them running in all those places at once.

## One command

With the CLI installed, any OpenAPI spec becomes a running mock:

```bash
mockzilla petstore.yml
```

The server starts on port 2200 with the API explorer at its root, the same browsable UI a hosted simulation serves.

(Image: The API explorer of a locally running portable server, with the template's hello-world and petstore services in the sidebar)

*A portable server running the template's two services, explorer at the root*

It takes more than a file:

```bash
mockzilla https://petstore3.swagger.io/api/v3/openapi.json   # a spec by URL
mockzilla ./                                                 # a folder of specs or services
mockzilla petstore.mockz                                     # a packaged simulation
```

See Install the CLI (topic `getting-started/install-the-cli`) for getting `mockzilla` onto your machine, and Run a simulation locally (topic `simulations/run-locally`) for the `.mockz` route: every deployed simulation hands you its package there, so hosted and local stay the same mock.

## The folder is the simulation

Pointing the engine at a directory reads one of three shapes, from throwaway to full project:

- **A pile of specs**: drop spec files in a folder and each becomes a service named after its filename. Nothing else needed.
- **One service folder**: a spec plus optional `config.yml` (latency, errors, upstream, mount), `context.yml` (values for generated data) and static endpoint files.
- **A `services/` tree**: one folder per service, each with the same layout - the shape the GitHub Action (topic `simulations/github-simulations`) deploys and the [template](https://github.com/mockzilla/mockzilla-portable-template) ships.

Static endpoints follow the convention from the app: path segments as folders, the method as the last folder, `index.<ext>` as the body.

See Endpoints and static responses (topic `simulations/endpoints-and-static-responses`).

## Edit and watch it change

The server watches your files. Save a spec, a config, a context or a static endpoint and the affected service is swapped live, no restart: edit the YAML on the left of your screen, curl the new behavior on the right.

## The same settings, as files

Everything a hosted simulation configures in the app, a portable one configures in `config.yml` per service: latency and error injection, an upstream with mock fallback, caching, history, replay. The options and their meaning match the Service settings (topic `simulations/service-settings`) page one for one.

The full flag and config reference lives with the engine: portable mode documentation (topic `engine/usage/portable`).

## One pack, many places

The point of the pack is running it everywhere at once, from one set of files:

- **On your machine** while you develop, hot reload included.
- **In CI**: a pipeline step starts its own copy, the tests run against it, and it dies with the job.
- **Hosted**: the same folder deploys through the GitHub Action (topic `simulations/github-simulations`), so the team's shared URL serves exactly what the repo holds.
- **Offline or air-gapped** when it has to be: once the binary and the files are there, nothing else is needed.

Because every copy reads the same files, the repository is the single source of truth. Each copy picks a merge up in its own rhythm: the hosted URL on the push that follows it, a pipeline on its next run, a laptop on the next pull.
