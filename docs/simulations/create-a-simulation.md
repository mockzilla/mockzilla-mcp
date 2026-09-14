# Create a simulation

A new simulation is a container with a URL of its own and nothing in it yet. Creating one serves nothing; endpoints appear at the URL only after a deploy.

## Ways to start

Open **Simulations** and click **New simulation** to start blank, or pick another start from the arrow next to it:

- **Blank simulation** starts from scratch; you add endpoints and specs yourself.
- **Sample simulation** comes prefilled with the Petstore spec and a few static endpoints. The Quickstart (topic `getting-started/quickstart`) walks through it.
- **Browse catalog** starts from a curated API: Stripe, Twilio, Auth0 and more. See Start from the catalog (topic `simulations/start-from-the-catalog`).
- **Backend sandbox** is a different kind of simulation: a payment or identity provider run as your own sandbox. See Create a sandbox (topic `backends/create-a-sandbox`).

Your own OpenAPI spec is added inside the simulation once it exists, whichever way you started.

See Upload and update an OpenAPI spec (topic `simulations/upload-a-spec`).

A simulation can also be deployed straight from a GitHub repo, with a URL per branch and pull request.

See GitHub Action (topic `developer-tools/github-action`).

## Name, domain and slug

Starting blank opens this dialog:

(Image: The Create new simulation dialog with name, domain and slug fields)

*The Create new simulation dialog*

- **Name** is the display name shown in lists. Change it any time.
- **Domain** picks which API host the simulation's URL uses. The default is fine.
- **Slug** becomes part of the URL: `<domain>/app/<your-org>/<slug>`. Lowercase letters, digits and hyphens, kept short; the form checks availability as you type.

The slug is fixed from the first deploy on, to keep public URLs stable.

> A simulation counts against your plan's allowance from the moment it is created, deployed or not. Deleting one frees the slot.

## After creating

The simulation opens on its **Endpoints** view. Nothing is served yet: shape what it should answer, then click **Deploy** to put it live at its URL.

See Deploy and URLs (topic `simulations/deploy-and-urls`).
