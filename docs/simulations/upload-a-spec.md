# Upload and update an OpenAPI spec

A simulation serves your own API from its OpenAPI spec. YAML and JSON both work, OpenAPI 3.0 and 3.1. Swagger 2.0 is not supported; convert it to OpenAPI 3 first. Specs with circular references are fine: generation detects the cycle and handles it.

## Upload a spec

In the simulation, open **Endpoints**, click **Add** and pick **OpenAPI spec**. Drop the file or browse for it, then pick the mount path; the dialog previews the URL your spec will answer on.

(Image: The Upload OpenAPI spec dialog with drop zone, size limit and mount path)

*The upload dialog*

Click **Add spec**, then deploy to put it live.

## The size limit

A spec file can be up to 4 MB. That is a soft limit: if your spec is bigger, split it into several specs, or [contact us](https://mockzilla.org/contact) and we can raise it for your organization.

Codegen simulations have no upload limit, because there is no upload: the code is generated from your spec inside your repository, and the spec itself never reaches us.

See Codegen simulations (topic `simulations/codegen-simulations`).

## Large specs

A big spec is heavier to serve: it takes more memory and boots more slowly than a small one.

> A heavy spec may need more memory or a longer timeout than your plan provides. Calls may time out until the plan fits the spec.

Two per-service options help, under **Service config** in the **Spec options** tab:

- **Lazy-load operations** parses each operation on its first request instead of all at startup. It speeds up boot for large specs.
- **Simplify schema** trims oversized schemas (extra anyOf/oneOf/allOf branches) so very large specs stay manageable.

(Image: The Spec options tab with lazy-load and simplify schema toggles)

*Spec options for a service*

## Replace a spec later

Your API changes; the mock follows by replacing the file. In **Service config**, pick the service, open the menu in the corner and choose **Replace file**. The mount path stays, and endpoint selections stay the same where paths match, so what you switched off stays off.

(Image: The service menu open in Service config with the Replace file action)

*Replace file in the service menu*

Deploy again to ship the new version.
