# Pin a build version

Each type of sandbox is published as builds. A build is one version of everything that type ships: its providers, their endpoints, the triggers they answer to and the values they return.

A sandbox follows the latest build unless you pin it to one.

## Where it is

Open the sandbox, go to **Providers**, and use **Base image** at the top right.

(Image: The base image control, with the sandbox pinned to one build while it still runs another.)

*A sandbox pinned to one build while it still runs another.*

**Follow the latest build** is the default. Pick a version instead to hold the sandbox on it.

## Following the latest

When we publish a build, sandboxes that follow it move to the new one. Nothing to do at your end.

That is what you want most of the time. New versions of the APIs you hold, new endpoints on them and fixes arrive as they ship.

A brand a build adds is a separate matter. It shows up in the catalogue to buy, not in your sandbox.

## Pinning

Pin when answers have to stay the same over time:

- A test suite you do not want to re-baseline.
- A release you are still supporting.
- A bug you are reproducing against the build it appeared on.
- An audit or a review, where the environment behind the evidence has to stay as it was for as long as it runs.

A pin holds until you change it. Publishing does not move a pinned sandbox.

## Changing what a sandbox runs

Choosing a build stores the choice. The sandbox keeps running what it has until you **Deploy**, and the panel says which build that is while the two differ.

When the build you pick has different providers from the one you run, the panel names what it adds and what it drops, counting only the brands your organization holds.

Not every build carries every provider. If the build you pick does not have one your sandbox serves, the provider list marks it **Not in this build**. That build will not serve it. Check the list before you deploy a pin.

## Older builds

A build stays deployable for two years after it is published. After that it retires: the list marks it, and it can no longer be picked or deployed, though you can still read what it contained.

If a sandbox is pinned to a build that retires, move it to a newer one and deploy.

## Where to go next

- Create a sandbox (topic `backends/create-a-sandbox`)
- Add providers (topic `backends/add-providers`)
- Sandbox activity (topic `backends/sandbox-activity`)
