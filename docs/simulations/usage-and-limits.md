# Usage and limits

Every plan comes with numbers: how many requests per month, how many at once, how many simulations. This page is about where to watch them and what happens when one runs out.

## Usage at a glance

The panel above the simulations list sums up what your organization's simulations served:

(Image: The time range row and six usage cards: requests against the monthly allowance with a top-up link, data transfer, rate limited, platform errors, deployments and route updates)

*The usage cards above the simulations list*

- **Requests**: calls served in the chosen range, next to the monthly allowance.
- **Data transfer**: response bytes sent, against the plan's allowance where one applies.
- **Rate Limited**: requests the platform answered with a 429 instead of serving. A number here means callers hit a limit.
- **Platform Errors**: failures on our side, not yours.
- **Deployments** and **Route updates**: how often the simulations were deployed and reconfigured.

The range switches between the last 24 hours, 7, 30 and 90 days; longer ranges belong to plans that include them. Each simulation row in the list below carries its own request and error count for the same range.

## The meters

Simulations and refs are counted against the plan the moment they exist, deployed or not:

(Image: The simulations meter full against its allowance, with the refs meter beside it)

*One of one simulations used, and the refs meter beside it*

A full meter means the next create is refused until something is deleted or the plan grows.

## What each limit does

- **Monthly requests** cover all simulations together and reset on the first of the month. Beyond the allowance, requests are answered with 429 until the counter resets or a top-up adds more.
- **Throughput** caps how many requests per second the simulations handle at the same moment. Short bursts above it are throttled with 429s, which is what the Rate Limited card counts.
- **Data transfer** is the response traffic your simulations send out, measured against the plan's allowance.
- **Memory and timeout** shape each request at runtime: a heavy spec needs memory, a slow upstream eats into the timeout. Both show on the simulation's Deployment tab.

See Upload and update an OpenAPI spec (topic `simulations/upload-a-spec`) for when a spec outgrows its memory, and Service settings (topic `simulations/service-settings`) for keeping the upstream timeout inside the request timeout.

## Adding headroom

**Top up**, on the Requests card or under Billing, buys a one-time request pack on top of the monthly quota; it is the quick fix for a month that turned busier than planned. Everything else, more throughput, more simulations, more memory, longer history, comes with a plan change.

> The numbers behind each limit are per plan; the pricing page lists them side by side.
