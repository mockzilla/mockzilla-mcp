# Deploy and URLs

Everything you stage in the app - endpoints, services, settings - reaches the world through a deploy. This page is about that moment: the URL a simulation answers on, what the Deploy button actually does, and the habits that keep deployments optimal.

## The URL

A simulation answers at:

```
https://<domain>/app/<your-org>/<slug>   # built in the app
https://<domain>/gh/<org>/<repo>         # deployed from GitHub
```

The first path segment names where the simulation came from; the rest is who owns it and what it is called. The domain is picked when the simulation is created, changeable under **General**. Six are available, all serving the same platform:

- `api.mockz.io` - the default
- `api.mockz.org`
- `api.mockz.net`
- `api.mockzilla.org`
- `api.mockzilla.de`
- `api.mockzilla.net`

The slug stays editable until the first deploy and is fixed permanently after it, so public URLs never break behind your consumers' backs. A simulation that must answer under a different slug is a new simulation: duplicate it and deploy the copy.

> Custom domains are part of enterprise plans today; we are working on bringing them to lower tiers. If you need one, contact us.

## What a deploy does

**Deploy** packages the simulation's current state and ships it to the runtime. The status pill walks through deploying to **Active**, and the URL serves the new state.

The first deploy of a simulation takes around a minute: the runtime is being placed, in your preferred region when it has capacity. Redeploys are much faster - the runtime exists, only the content changes - which is why the edit-deploy loop feels closer to a save than to a release.

The **Deployment** tab shows the placement and the runtime numbers each deploy runs with: region, memory, timeout.

See Usage and limits (topic `simulations/usage-and-limits`) for what shapes those numbers.

## Take it offline

A simulation you are not using has no reason to stay deployed. **Take offline**, in the simulation's menu, stops serving the URL; everything you built stays exactly as it is, and **Bring online** puts it back.

## Build limits

Each deploy is a build, and plans carry a soft allowance for how many builds a month makes sense - the Deployments card on the usage panel counts yours against it. Soft means what it says: the limits exist to keep the platform honest, not to get in your way. If yours do not fit how you work, [contact us](https://mockzilla.org/contact) and we can consider lifting them.
