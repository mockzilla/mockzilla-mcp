# Start from the catalog

The catalog is a curated set of provider APIs: the specs teams ask for most, prepared so a working mock is one click away. Stripe, Twilio, Adyen and more, each with a description, tags and a version to pick.

## Browse it

Open **Simulations**, click the arrow next to **New simulation** and pick **Browse catalog**. Search by name or tag, or filter by category.

(Image: The catalog page with searchable provider API cards)

*The catalog*

The catalog grows by request: if the API you need is not in it, [contact us](https://mockzilla.org/contact) and we will look at adding it.

## What a spec ships

The info button on a card opens the details:

(Image: The spec details dialog with version, endpoints and links)

*Spec details, here for the Stripe mock*

- **Version** is the build of the mock you get. Some specs keep several; pick one on the card, or take the latest.
- **Endpoints (active / total)** is what the mock serves out of the provider's full API. Some specs are trimmed on purpose: the Stripe mock keeps the checkout flow and leaves the rest out, so it stays small and fast.
- **Links** point at the provider's own documentation and terms.

Specs differ in what they need to run. A heavy one carries a recommended memory and timeout, and the import compares them against your plan.

> A spec can recommend more memory or a longer timeout than your plan provides. You can still import it, and the import says so; calls may time out or be killed if the spec needs more than the plan gives.

## From catalog to running mock

Click **Add** on a card. A simulation is created for you, named automatically, with the spec attached; it opens ready to deploy.

Inside an existing simulation the same catalog sits under **Sources**. There **Add to simulation** attaches the spec to that simulation instead, on a mount path you pick; the dialog previews the URL the spec will answer on. One simulation can serve several providers side by side this way.

(Image: The import dialog adding Stripe to an existing simulation with a mount path and preview URL)

*Adding a catalog spec to an existing simulation*

Then deploy as usual.

See Deploy and URLs (topic `simulations/deploy-and-urls`).
