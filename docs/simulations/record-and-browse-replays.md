# Record and browse replays

A replay is a recorded response served back for matching requests: record once, replay forever after, like a VCR. The first matching call stores whatever the simulation answered, generated or fetched from an upstream; every later matching call returns that stored response, marked with the `X-Mockzilla-Source: replay` header. Use it to keep a payload stable across test runs, to capture a real backend's answer once and then work without it, or to hand-craft the exact response a flow needs.

## How a recording is matched

Every recording is filed under a key built from the method, the path pattern, and the request fields you choose:

- **Body fields** are dotted JSON paths (`name`, `data.address.zip`, `items[0].sku`) or form field names.
- **Query params** come from the URL query string.
- **Path params** are the `{placeholder}` values in the path. They are ignored unless listed: by default `/pets/1` and `/pets/2` share one recording, and listing `petId` gives each id its own.
- **No fields at all** means path only: every request to the endpoint shares a single recording.

Only the chosen fields matter; everything else in the request is ignored. Two requests with the same values for those fields get the same recording. If a chosen field is missing from a request, replay skips that request entirely: nothing is recorded and nothing is replayed.

## Record without any setup

The fastest way in needs no configuration: send the `X-Mockzilla-Replay` header. This works on any deployed simulation.

```bash
# First call: records the response (here: match on the body field "name")
curl -X POST "https://api.mockz.io/app/your-org/your-sim/petstore/pets" \
  -H "Content-Type: application/json" \
  -H "X-Mockzilla-Replay: name" \
  -d '{"name": "Rex", "tag": "checkout-flow"}'

# Every later call with name=Rex: returns the exact same response
curl -X POST "https://api.mockz.io/app/your-org/your-sim/petstore/pets" \
  -H "Content-Type: application/json" \
  -H "X-Mockzilla-Replay: name" \
  -d '{"name": "Rex", "tag": "different-tag-does-not-matter"}'
```

Check the response headers: the first call says `X-Mockzilla-Source: generated` (or `upstream`), the second says `X-Mockzilla-Source: replay`.

The header names the fields to match on. Bare names are body fields; prefixes pick other sources, `;` separates them:

```bash
# Empty: use the match key configured in the app, or path only
-H "X-Mockzilla-Replay:"

# Two body fields
-H "X-Mockzilla-Replay: biller,reference"

# Body, query and path fields together
-H "X-Mockzilla-Replay: body:reference;query:channel;path:paymentMethod"
```

## Set it up in the app

Configuration replaces the header: clients call the simulation like any other API and the recording rules live with the simulation. Open **Replays** in the sidebar and pick a service.

(Image: The Replays view: recording pill, service replay settings with auto-replay, upstream-only and TTL, and the endpoint table with match key chips and recording counts)

*The Replays view for one service: recording settings and the endpoint table*

1. **Turn recording on.** The app default applies to every service; a service can override it. The pill next to the title says whether recording is on for what you are looking at.
2. **Pick an endpoint and set its match key.** The table shows every endpoint, its match key and how many recordings it holds. Click a row:

(Image: The Replay match drawer: query and body field inputs, the body field name as a chip, and X-Mockzilla-Replay header examples)

*The match key editor with a body field and the matching header examples*

The editor shows the exact `X-Mockzilla-Replay` header for the key you build, ready to copy. **Enable replay here** switches the one endpoint on; endpoints without a match key just share one recording per path.

3. **Auto-replay**, on the service settings, records and replays configured endpoints without any header. Turn it on when the calling code cannot be changed.
4. **Record upstream only** is for capturing a real backend: generated responses are not recorded, and return a 502 instead, so a recording session cannot silently fill up with mock data.
5. **TTL** sets how long upstream recordings live, falling back to the app default of 24 hours.

> Match keys, auto-replay and the other settings here ship with the next deploy. Recordings themselves are live: create, edit or delete one and the running simulation serves the change immediately.

## Browse and edit recordings

Each endpoint's drawer lists its recordings by their match values, status and source: `upstream` was captured from a real backend, `generated` from the mock, `manual` was written by hand.

(Image: A recording opened in the drawer: match values in the picker, manual source chip, status 201, content type and the editable JSON response body)

*A recording opened for editing: status, content type and the response body*

- **Edit** the status, content type or body and save; the runtime serves the edited response for that key from then on. Recording once and then tweaking the payload is often faster than crafting it from scratch.
- **New recording** creates one by hand before any traffic exists: set the match values, the status and the body, and the endpoint answers with it from the first request.
- **Delete recording** removes one key; **Delete all** empties the endpoint.
- Upstream recordings expire after the TTL. Manual and generated ones have no TTL and are kept until deleted.

A recording made with an ad-hoc header on a path with no configured endpoint still shows up here, grouped under its path, so nothing recorded is invisible.

Replayed calls appear in History like every other request; the response header is what names the replay as their source.

See Request history (topic `simulations/request-history`).

## What wins when features stack

A replay hit short-circuits early: if a recording matches, it answers, before caching and before the upstream is contacted. With no matching recording the request continues as usual, and on the way back the response is captured for next time. Latency and error injection still apply on the way in, so a replayed endpoint can still be slow or fail on purpose.

Moving recordings between simulations or sharing them with the team is its own page.

See Export and import replays (topic `simulations/export-and-import-replays`).
