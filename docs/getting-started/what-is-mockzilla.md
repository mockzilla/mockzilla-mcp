# What is Mockzilla?

Mockzilla is an open source mock server for any API that has an OpenAPI spec. We build and maintain it; the code is [on GitHub](https://github.com/mockzilla/mockzilla), MIT-licensed. mockzilla.org is the cloud version: it helps teams build mock servers, deploy them, and share them at a stable URL.

## Why we build it

Your tests are only as good as what they run against. Even well-known API providers go down, and when their sandbox is the only thing your integration can talk to, that outage blocks your release. In the AI age code gets written and shipped faster than ever, so trusted tests need mocks you control: a dependency that answers like the real thing and is there when you need it.

## Open source at the core

We love open source, and the server is where everything starts. It reads your OpenAPI spec and serves a valid response for every endpoint in it:

- Responses generated from your schemas, with realistic values.
- Request validation against the spec.
- Latency and error injection.
- Proxy mode: forward to a real upstream and fall back to mocks when it is down.
- Replay: record a real response once and serve it back for matching requests.

It runs on your machine through the CLI or Docker, no account needed.

See Install the CLI (topic `getting-started/install-the-cli`).

## The cloud platform

Everything we make is for developers: you bring a spec, you get a URL. A simulation is a hosted mock API your whole team shares. No local server, no port conflicts. Create one in the app: start blank, use the prefilled Petstore sample, pick an API from the catalog, or bring your own spec.

Each one comes with:

- An API explorer to browse and try endpoints in the browser.
- Request history: every call, with method, path, status and timing.
- Replays and static endpoints for the cases generated data cannot cover.
- Share links and access control.

## Deploys from your repo

Add the GitHub Action and push. Every branch gets its own URL, and every pull request too; the PR one is removed when the PR closes. This is free as well. Two modes, each with a template repo that already ships the action, so Use this template on GitHub is the whole setup:

- [Start from the portable template](https://github.com/mockzilla/mockzilla-portable-template/generate): your specs, packed from the repo. No code.
- [Start from the codegen template](https://github.com/mockzilla/mockzilla-codegen-template/generate): Mockzilla generates typed Go handlers from your spec. You add your own logic and ship the compiled result.

## Free for small teams

Mockzilla is free to use. There are limits, because we pay for the cloud it runs on, but in our humble opinion the free allowance is enough for a small team. Verified students get a bigger one, free the whole time they are enrolled.

See [For Students](https://mockzilla.org/students).

For advanced functionality and higher volumes, hundreds of thousands or millions of requests, we offer paid plans at reasonable prices.

See [Pricing](https://mockzilla.org/pricing).

## Resilient backends

Sandboxes for payment and identity providers, run as your own. Endpoints, response shapes and status codes match the provider's, so your integration only changes its base URL. You decide what it answers, and it stays up.

See the Resilient backends overview (topic `backends/overview`).

## What Mockzilla is not

- Not a contract testing tool, even though a mock answers with the same verified shapes the original service does, and we check that continuously across more than 2,000 API services.
- Not a load testing tool. A mock can be the target of one though: when your provider's sandbox throttles or blocks load tests, point them at your mock instead. The request rates we set are soft limits; [contact us](https://mockzilla.org/contact) and we can usually raise them on demand.
- Not a production gateway. Mocks are for development and testing.
- REST and OpenAPI only. No GraphQL or gRPC yet.

## Where to go next

- Quickstart: your first simulation (topic `getting-started/quickstart`)
- Core concepts (topic `getting-started/terminology`)
- Install the CLI (topic `getting-started/install-the-cli`)
