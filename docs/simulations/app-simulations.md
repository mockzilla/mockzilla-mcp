# App simulations

An app simulation is the kind you build in the browser: create it, fill it with services, deploy it, and it answers at its URL. It is the default kind, the one the rest of these docs quietly assume, and nothing about it requires installing anything.

## One simulation, many services

A simulation is a container for services, and each service is one API. A single simulation serves several side by side, the way your production system talks to several dependencies, so one URL can stand in for your whole backend. Services come from three places:

- **Your own OpenAPI spec**, uploaded and mounted at a path prefix.
- **A catalog spec**: Stripe, Twilio, Auth0 and the rest, added in two clicks.
- **Static endpoints**, hand-written responses that group into services by their first path segment.

They mix freely. A typical simulation carries the team's own API from a spec, a payment provider from the catalog, and a handful of static endpoints for the odd corner nothing else covers - all under `<domain>/app/<your-org>/<slug>`, each service at its own prefix, all shipped by one deploy.

See Upload and update an OpenAPI spec (topic `simulations/upload-a-spec`), Start from the catalog (topic `simulations/start-from-the-catalog`), and Endpoints and static responses (topic `simulations/endpoints-and-static-responses`).

## Everything hangs off the simulation

Everything about a simulation lives in its sidebar, in groups:

(Image: The simulation sidebar: Sources with Endpoints, Catalog and Contexts; Recordings with History and Replays; Settings with General, Deployment, Access and Variables and Service config)

*The anatomy of one app simulation, in its sidebar*

- **Sources** are what it serves: the endpoints, the catalog to add more, and the contexts that shape generated data.
- **Recordings** are what it remembers: the request history and the replays it captured.
- **Settings** are what shapes it: name and icon, the deployment's runtime, who may reach it, and each service's own configuration.

Two simulations share nothing here. Each has its own URL, its own history and recordings, its own access policy, which is why a simulation per project or per environment is the usual cut.

## The loop

Everything is edited in the app and saved as you type; the running simulation keeps serving the last deployed state until you click **Deploy**, and a deploy takes seconds. That split is what makes an app simulation comfortable to iterate on: stage as many changes as you like, ship them when ready, and the URL never changes.

See Create a simulation (topic `simulations/create-a-simulation`) for the first one, and Deploy and URLs (topic `simulations/deploy-and-urls`) for what a deploy does.

## When another kind fits better

- Mocks that should live in a repo and be reviewed as code: deploy them from GitHub (topic `simulations/github-simulations`).
- The same mock offline or inside CI: run it portable (topic `simulations/portable-simulations`).
- Responses that need real logic: generate a codegen simulation (topic `simulations/codegen-simulations`).

Moving later is packing the same files differently: every deploy of an app simulation already produces the portable package, which Run locally hands you.
