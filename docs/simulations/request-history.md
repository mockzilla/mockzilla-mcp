# Request history

Every request a simulation answers leaves a record: when it came in, what it asked, what went back, and who answered. History is the log you open when a client misbehaves, an integration fails, or you need to see the exact request and the exact answer.

## Browse the log

Open **History** under Recordings in the sidebar and pick a service. Each row is one request: time, method, the full path with its query string, the status, the source, and how long the answer took.

(Image: The History view: recording pill, service and time range filters, the inherited recording card and a table of requests with status, source and duration)

*The History view: one service's requests, newest first*

- **Source** says who answered: `mock` is the simulation, `upstream` is your real backend behind it.
- The time range menu narrows the list: the last 15 minutes, hour, 24 hours, 7 days, or a custom range.
- Entries load newest first; **Load older** pages further back.

The same columns exist as response headers on the wire: `X-Mockzilla-Source` and `X-Mockzilla-Duration` on every response the simulation sends.

## The detail view

Click a row for the whole exchange: request headers and body on top, response headers and the pretty-printed body below, with source, duration and the exact timestamp in the header.

(Image: A request opened in the detail drawer: request headers with a masked Authorization value, response headers and the pretty-printed JSON body)

*One request opened: headers, bodies, source and duration*

## Masked headers

Credentials do not belong in a log. Header values on the mask list are masked when the entry is recorded, keeping only the last four characters, `***********4f2a` style, so the original value is never stored at all. `Authorization`, `Cookie`, `Set-Cookie` and `X-Api-Key` are masked from the start; add your own by name, or as a prefix pattern like `X-Internal-*`. Matching is case-insensitive.

## Recording and retention

Recording is on by default, with a one-hour window: entries older than the retain duration expire on their own. History is a rolling window for debugging, not an archive.

The global default applies to every service; **Override global** gives one service its own recording switch, retain duration and mask list.

(Image: The per-service recording card with Override global on: record toggle, retain duration and mask header chips)

*A service overriding the global default: record, retain and the mask list*

Turn recording off before a load test. Logging every request adds a little work to each call, and a test that fires thousands of identical requests fills the window with rows that tell you nothing; the numbers you care about live in the load tool anyway.

> Like other simulation settings, changes here ship with the next deploy.
