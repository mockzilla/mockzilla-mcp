# Simulation types

Everything in this documentation runs the same mock engine; what differs is where a simulation lives and who deploys it. There are four ways to run one, and they are not exclusive: teams commonly develop against a hosted simulation, run a portable copy in CI, and keep a codegen service for custom logic.

## App simulations

The default. Built and configured entirely in the browser: add OpenAPI specs and static endpoints, click **Deploy**, and the simulation answers at its URL. Everything in the Create, Configure, Replays and Observe sections of these docs works on an app simulation.

Choose it when you want a hosted mock your whole team can reach, with nothing to install and every change made in the app.

See App simulations (topic `simulations/app-simulations`).

## Simulations from GitHub

The same hosted simulation, but the repository is the source of truth: specs, static endpoints and config live as files, and a push deploys them through the GitHub Action, with a URL per branch and pull request. The Action ships either project shape: a portable folder served as-is, or a codegen project built from source. The app shows these simulations read-only; changing one means changing the repo.

Choose it when mocks should be reviewed like code and every branch needs its own environment.

See Simulations from GitHub (topic `simulations/github-simulations`).

## Portable simulations

A folder of specs, static files and config that the engine serves as-is, wherever it runs: locally with the CLI, in Docker, inside CI, or hosted through the GitHub Action's portable mode. The layout is the same one app simulations package on deploy, so the formats stay interchangeable.

Choose it when the mock should live as plain files: offline work, CI pipelines, a repo your team reviews, or anything that must not leave your network.

See Portable simulations (topic `simulations/portable-simulations`).

## Codegen simulations

A generated Go server: the engine turns your spec into typed handlers you can open and edit, so responses can carry real logic, state and arithmetic where generation alone is not enough. The spec never leaves your repository, which also frees it from any upload limit.

Choose it when the mock needs behavior no configuration can express.

See Codegen simulations (topic `simulations/codegen-simulations`).

## And the ready-made kind

Payment and identity sandboxes are simulations too, running the same engine with provider behavior already built: scenarios, failure modes and realistic data out of the box. They have their own section.

See Resilient backends (topic `backends/overview`).

## Picking one

| You want | Pick |
|---|---|
| A hosted mock the team edits in the browser | App simulation |
| Mocks reviewed as code, one URL per branch | From GitHub |
| The same mock offline, in Docker or CI | Portable |
| Handlers with real logic in them | Codegen |
| A payment or identity provider that just works | Backend sandbox |

Whatever you pick, the engine is the same: a spec generates the responses, static endpoints pin exact ones, and contexts shape the data. Moving between types later is packing the same files differently, never starting over.
