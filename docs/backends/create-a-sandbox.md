# Create a sandbox

A sandbox is one deployed simulation that serves the providers you pick. This page takes it from nothing to a URL your integration can call.

## Before you start

You need a provider. A sandbox has to serve something, and it can only serve brands your organization already holds.

See Add providers (topic `backends/add-providers`).

Your plan has to allow a sandbox, and the app says so on the Backends page when it does not. A sandbox is a simulation like any other, so it also comes out of the same simulation allowance as the rest of your work.

Anyone with the editor role or above can create one. Buying providers is owner-only, but building a sandbox out of what the organization already owns is not.

## Create it

Open **Backends** and use **New sandbox** on the row for the type you want. You can also start from **Simulations**, where sandboxes live alongside everything else.

(Image: The new sandbox dialog: the type, a name, and the segment that goes in the URL.)

*Three fields: the type, a name, and the segment that goes in the URL.*

Three fields:

- **Type** is payments or identity. It cannot be changed later, because it decides which engine runs.
- **Name** is for you, and it is what the app lists. Change it whenever you like.
- **URL segment** is part of the address. Lowercase, at most 15 characters.

The segment stays editable until the first deploy and is fixed after it. That is deliberate: it sits in the middle of the URL your code calls and it prefixes everything the sandbox records, so a rename afterwards would break running integrations and orphan the records at the same time.

Creating a sandbox serves nothing yet. It has no providers until you pick them, and a sandbox with none is refused at deploy.

## Choose what it serves

Open the sandbox and go to **Providers**. You get everything the organization holds, and you tick what this one serves.

(Image: The provider picker, with one brand served and one still unticked.)

*Pick a whole brand, or narrow to one API or one exact version.*

Pick at whichever level fits:

- The **brand**, such as Adyen, which covers every API and version under it.
- One **API** of that brand.
- One **exact version**, such as `adyen/checkout/v71`.

Ticking the brand covers everything below it, and the narrower rows say so rather than letting you tick the same thing twice. **Select all** takes every brand you hold.

Only brands your organization holds appear here. If the build the sandbox runs no longer ships one of them, it is marked and cannot be picked.

Running more than one sandbox with different picks is normal. If a sandbox serves a single brand, every request to it reaches that vendor and no other, which is what you want when a test is about one integration.

## Deploy it

**Deploy** puts the sandbox up. Nothing is served until you do, and provider changes reach a running sandbox the same way: save, then deploy.

The status pill walks through to **Active** and the URL starts answering. The first deploy takes longer than later ones, since the runtime is being placed.

(Image: A deployed sandbox: its status and the URL it answers on.)

*Active, with the URL the sandbox answers on.*

The address follows the pattern every simulation uses, with each provider under its own prefix:

```
https://<domain>/pay/<your-org>/<name>/adyen/checkout/v71/payments
https://<domain>/kyx/<your-org>/<name>/onfido/v3.6/applicants
```

Everything after the prefix is the provider's own path, so pointing your integration at the sandbox is a base URL change and nothing else.

## Settings worth knowing

**General** holds the name, the URL segment and **Behaviour**, which controls what the sandbox does besides answering:

(Image: The behaviour settings: API explorer, recorded traffic and replay.)

*What the sandbox does besides answering requests.*

- **API explorer** shows a browsable UI at the sandbox's URL. Turn it off and only the API answers.
- **Record traffic** keeps every request and response, which is what fills History. **Keep for** is how long they live.
- **Replay** records a response once and answers matching requests with it afterwards.

**Deployment** is where it runs, and **Access** is who can reach it. Both behave as they do for any simulation.

See Access control (topic `simulations/access-control`).

## After it is up

The sandbox keeps a record of what it has done, browsable per provider.

See Sandbox activity (topic `backends/sandbox-activity`).

By default it follows the latest published build. Pin it to one build if a test suite needs the same answers over time.

See Pin a build version (topic `backends/pin-a-build-version`).

## Where to go next

- Write your own scenarios (topic `backends/write-your-own-scenarios`)
- Change values with contexts (topic `backends/contexts`)
- Sandbox activity (topic `backends/sandbox-activity`)
