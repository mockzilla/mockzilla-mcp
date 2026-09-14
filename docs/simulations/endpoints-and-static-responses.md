# Endpoints and static responses

A simulation serves endpoints: each one is a method and a path answering at the simulation's URL. They come from two sources. OpenAPI endpoints come from your spec and answer with data generated from its schemas. A static endpoint you define yourself: pick a method and a path, type the response body, and callers get that body back unchanged.

## The Endpoints view

Open a simulation and it starts on **Endpoints**. Both kinds are listed there together, grouped by service.

(Image: The Endpoints view listing static services and an OpenAPI service, grouped with toggles and chips)

*The Endpoints view of the sample simulation*

- The toggle switches an endpoint on or off. A switched-off endpoint is left out of the next deploy.
- The chip next to the toggle is a static endpoint's content type: JSON, TEXT, HTML or XML.
- Latency and error rules show on the row too, like the `300ms` and `10% 503` above.
- Click a row to open its settings.

Search and the service filter sit above the list. Long lists paginate at 50 endpoints per page.

## Two kinds of endpoints

OpenAPI endpoints follow a contract. The spec defines each response's shape, so the body is read-only in the app, and every call generates fresh data that fits the schema. To change them, change the spec.

See Upload and update an OpenAPI spec (topic `simulations/upload-a-spec`).

A static endpoint has no contract. There is no file to upload and no schema to fit: the response is the text in the editor, and a call gets status 200 with exactly that text. That makes it the fastest way to put a route on the wire:

- mock a dependency that has no OpenAPI spec,
- serve the one exact payload a test asserts on,
- answer a health check, a config blob or a small HTML page,
- pin one route of a spec to a fixed response while the rest stays generated.

## How the URL is built

A simulation answers at `<domain>/app/<your-org>/<slug>`, and every endpoint lives under that. A static endpoint is served at its path as typed; `GET /health` above answers at:

```
https://api.mockz.io/app/docs-shots/tidy-valley/health
```

OpenAPI endpoints answer under the spec's mount path instead: Petstore's `GET /pets`, mounted at `petstore`, answers at `/petstore/pets`.

Rules for a static path:

- It starts with `/`, has no trailing slash, and fits in 256 characters.
- A segment written as `{name}` matches any value: `/users/{id}/orders` answers for every id.
- One endpoint per method and path. The same path with two methods is two endpoints.

Static endpoints group into services by their first path segment: `/v1/greeting` and `/v1/ping` form the service `v1` on their own. There is nothing to set up; the service appears with its first endpoint and has its own service settings (topic `simulations/service-settings`).

## Add a static endpoint

In **Endpoints**, click **Add** and pick **Static endpoint**.

(Image: The Add menu on the Endpoints view with Static endpoint and OpenAPI spec entries)

*The Add menu*

The endpoint is created right away as `GET /new` with an empty JSON body, and opens for editing:

(Image: A static endpoint open for editing: method, content type, path and the response body editor)

*A static endpoint open for editing*

- **Method**: GET, POST, PUT, PATCH or DELETE.
- **Content type**: `application/json`, `text/plain`, `text/html` or `application/xml`.
- **Path**: where it answers.
- The editor holds the response body.

Every change saves as you type; there is no save button.

> Edits apply on the next deploy. The running simulation keeps serving what was last deployed until you click Deploy.

## Change a response

Open the endpoint, edit the body, click **Deploy**. A few seconds later the same URL serves the new response. Callers notice nothing: the URL, the method and the content type still match, only the payload changed. When the next test case needs a different answer, you change it here rather than in code.

## Override an OpenAPI endpoint

A static endpoint at the same method and path as an OpenAPI endpoint takes over that route. The list marks the pair: the static row gets an **override** chip, and the OpenAPI row is greyed out with an **overridden** one.

(Image: The Endpoints list filtered to pets: a static endpoint marked override above the greyed-out OpenAPI endpoint marked overridden)

*The Petstore's pet lookup, overridden by a static endpoint at the same path*

This is for the spec with a hundred endpoints where one response has to be yours. Without overrides you would fork the spec and maintain the whole copy for that one change. Here the spec stays as uploaded: add a static endpoint at the same full path, paste the payload, deploy. The other ninety-nine keep generating from their schemas, and replacing the spec file later leaves the override in place.

The overridden OpenAPI endpoint is not gone. Delete the static endpoint, or move its path, and it answers again.

## Latency and errors

A static endpoint can delay and fail on purpose. Open it and switch to the **Behavior** tab.

(Image: The Behavior tab of a static endpoint with 300 ms sleep and a 10 percent 503 error rule)

*Latency and an error rule on a static endpoint*

- **Sleep before responding** holds the answer for the given time.
- **Error injection** returns an error status for a share of requests: the rule `10% -> 503` fails one call in ten. Each request rolls a number from 1 to 100 and the rule with the lowest matching percent wins, so rules do not stack; the highest percent is the total error rate.

The remaining calls return status 200 with the body.

## A static endpoint is a file

Under the hood, each static endpoint is one file, and there is no format to learn: the folder structure is the URL.

- Every path segment is a folder: `/hello-world/v1` is the folders `hello-world/v1/`.
- The method is one more folder, in lowercase: `get/`, `post/`.
- The body is the `index` file inside it, and the extension picks the content type: `.json`, `.txt`, `.html` or `.xml`.

So `POST /hello-world/v1` is the file `hello-world/v1/post/index.json`. Read a URL and you know the file; read the tree and you know the API.

```
services/
  hello-world/
    v1/
      get/
        index.json    # GET /hello-world/v1
      post/
        index.json    # POST /hello-world/v1
```

Leave the method folder out and the file answers GET. A folder named `{petId}` matches any value, the same as in the app.

The editor in the app writes this layout for you on deploy. You can also write it yourself and keep static endpoints in version control next to your code: a portable simulation (topic `simulations/portable-simulations`) runs the same folder structure straight from your disk, and the GitHub Action (topic `developer-tools/github-action`) deploys it from a repo. The [portable template](https://github.com/mockzilla/mockzilla-portable-template/tree/main/services/hello-world) ships this exact hello-world service to start from.

## More than a fixed body

Being static only describes the response. On the wire these endpoints behave like any other:

- The **Upstream** tab can point one at a real backend, inherited from its service or overridden for the single endpoint.
- Every call to it is recorded in History (topic `simulations/request-history`).
- The deployed API explorer lists it next to the OpenAPI endpoints.
