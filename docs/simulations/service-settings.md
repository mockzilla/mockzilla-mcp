# Service settings

Every service in a simulation carries its own settings: where it proxies, what it caches, what it validates, and how its spec is served. They live under **Service config** in the sidebar.

## One page per service

The page configures one service at a time. Pick it in the dropdown at the top; the glyph marks whether it is a set of static endpoints or an OpenAPI spec.

(Image: The Service config page with the service dropdown open, listing three static services and the petstore OpenAPI service)

*The service dropdown on the Service config page*

The two kinds share most of this page. Upstream, Cache and YAML apply to every service; Validation and Spec options exist only for OpenAPI services, because both need a spec to work against. A static service also has no mount to edit: its prefix comes from its endpoints' first path segment.

The menu in the corner manages the service itself: **Replace file** swaps the spec, **Reset from catalog** restores a catalog spec, and **Delete service** removes it. Deleting a static service deletes every endpoint under its prefix.

> Everything on this page saves as you type and applies on the next deploy.

## Mount path

Next to the dropdown, an OpenAPI service shows its mount as `/<mount>/*`, editable in place. Lowercase letters, digits, `-`, `_` and `/`, no leading or trailing slash, up to 32 characters; a mount another service holds is refused. Changing it moves every endpoint of the service to the new prefix, so callers have to follow.

## Upstream

Turn on **Proxy to an upstream** and requests reach your real backend first; the simulation answers only when the backend does not.

(Image: The Upstream tab with proxying enabled: connection URL and timeout, added headers, fail-on status range and sticky routing)

*The Upstream tab with a proxy configured*

Who answers what:

- The upstream responds successfully: its response is returned to the caller unchanged.
- The upstream is unreachable, times out, or returns an error status: the generated mock answers instead.
- Statuses matching **Fail on upstream status** skip the fallback and reach the caller as-is. The default is `400-499` except `401` and `403`: your own bad request stays visible, while a missing credential falls back to the mock. **Match on the response body** refines a rule for backends that put error codes inside the body.

Every response names its source: the `X-Mockzilla-Source` header reads `upstream`, `generated`, `cache` or `replay`.

**Added headers** are attached to every proxied request; an auth token or a tenant id goes here rather than into every client.

**Sticky upstream routing** helps when a fallback happened mid-flow: after a caller gets a generated response, its later requests go straight to mocks for the set duration, so one request does not mix real state with generated state.

The **Timeout** is how long to wait for the backend, `5s` unless changed.

> The whole request runs inside your plan's request timeout. Keep the upstream timeout below it: a backend that consumes the entire window gets the request cut off before the mock can answer.

The upstream set here applies to the whole service. A single endpoint can override it with a different URL, from the Upstream tab in that endpoint's drawer; every other endpoint keeps using the service upstream.

See Endpoints and static responses (topic `simulations/endpoints-and-static-responses`).

## Cache

**Cache GET responses** returns the first response again for repeated GET requests instead of generating or refetching each time. Only GET requests are cached, and a cached answer wins over the upstream on repeats. Turn it on when consumers re-fetch and changing data would only be noise.

## Validation

An OpenAPI spec is a contract, and the **Validation** tab makes the simulation enforce it.

(Image: The Validation tab: validate requests, validate responses, verbose error details and the validation timeout)

*The Validation tab of an OpenAPI service*

- **Validate requests** checks incoming bodies, query and path params against the spec. A request that does not match gets a 400 with details and never reaches the upstream. This is the one to turn on while building a client: the mock tells you about a malformed call the moment you make it.
- **Validate responses** checks answers on the way out; a response that does not match the spec becomes a 500 with details. For generated responses this is rarely needed. It earns its keep with an upstream: every real response is checked against the spec, which turns the simulation into a contract test for the service behind it. It also catches a context value that breaks the schema it fills.
- **Verbose error details** puts the full reference schema into error payloads; slim by default.
- **Validation timeout** caps a single validation call, one second unless changed, so a pathological schema cannot hang requests.

## Spec options

These options control how the spec is loaded and served. They matter mostly for very large specs.

(Image: The Spec options tab: lazy-load operations and simplify schema toggles)

*The Spec options tab*

- **Lazy-load operations** parses each operation on its first request instead of all at startup. Faster boot for large specs, little difference for small ones.
- **Simplify schema** trims oversized schemas, dropping extra anyOf/oneOf/allOf branches. Switching it on reveals **Limit optional properties**: cap how many optional fields generated responses keep. Equal min and max means an exact count; a range picks randomly within it.

See Upload and update an OpenAPI spec (topic `simulations/upload-a-spec`) for when a spec is heavy enough to need these.

## The YAML tab

The same configuration as the other tabs, shown in the engine's raw YAML shape. Read-only for now; use it to see exactly what the deployed simulation will receive.
