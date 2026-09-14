# Terminology

Every product grows a vocabulary. This page says what ours means, and why we picked these words and not others.

## Simulation

A simulation is a running copy of a service: it lives at its own URL and answers like the original. We say simulation rather than mock on purpose. A mock is one faked answer wired into a test. A simulation behaves: it generates valid data from your schemas, validates what you send, injects latency and errors, can forward to the real service and fall back when it is down, and holds state where the real service would. The clearest case is a resilient backend (topic `backends/overview`) running a scenario: a payment you authorize now, capture later and refund next week is a conversation with state, not a fixed response. Sim is the same word, shorter; you will meet it in the app and in URLs.

## Spec

The OpenAPI document that describes an API. The industry's word, not ours, and we kept it. A spec is the source of truth here: everything a simulation serves is derived from it, so updating the spec is how you change the simulation.

## Service

One API inside a simulation. A simulation can serve several services side by side, the way your production system talks to several dependencies; an app sim (topic `simulations/simulation-types`) is exactly that composition. Called service because that is what it is to your code: the thing it calls.

**Can a service call another service?** Yes: a codegen handler is ordinary Go code, and ordinary Go code calls whatever endpoint it needs, a sibling service included.

In a repo, each service is one directory of specs; the [portable template's services directory](https://github.com/mockzilla/mockzilla-portable-template/tree/main/services) ships two.

(Image: File tree of the services directory: hello-world/v1 and petstore, each a folder with its own spec files.)

*Two services in the portable template, one directory each.*

## Endpoint

One method and path a service answers. Most are generated from the spec's operations. Static endpoints (topic `simulations/endpoints-and-static-responses`) are the other kind: a fixed method, path, status and body you write by hand, for the one exact response a test needs. Static because it never varies.

## Replay

A real response, recorded once and served back for matching requests. Replay because nothing is invented: what the upstream actually said gets played again. You configure what to record and how requests are matched; replayed traffic shows up in History like everything else.

See Record and browse replays (topic `simulations/record-and-browse-replays`).

## History

The log of every call a simulation answered: method, path, status, duration, and whether the answer came from the mock or the upstream. A plain name for a plain thing.

## Context

Named values that steer generated data. Without one, a generated field is technically valid and obviously fake; a context supplies the realistic values, currencies, merchant names, id formats. This is also where Mockzilla differs from other mock services: you control what a response contains with a few lines of YAML. No AI, no tokens, no pre-generated datasets, no other magic, and the same request keeps getting the same kind of answer. In resilient backends a context is YAML values used instead of what the provider ships. Context because it is the surrounding knowledge the generator reads when it fills a field.

## Scenario

A when/then rule in a resilient backend: when a request matches a trigger, a specific amount, a magic card number, a keyword, then a scripted outcome follows, a decline code, a timeout, a case sent to review. Providers do the same with test card numbers; the difference is that here you write the script. Scenario because you are rehearsing a situation, not stubbing an answer.

## Resilient backend

A drop-in replacement for a payment or identity provider's sandbox. Endpoints, response shapes and status codes match the provider's, so your integration changes nothing but its base URL. Resilient is the promise in the name: it stays up when the provider's sandbox is down, throttled, or unable to produce the failure you need to test.

## Sandbox

Your own instance of a provider's API. The provider's word, kept deliberately: you point your integration at it exactly like the provider's sandbox. The difference is ownership. It is yours: you decide what it answers, and nobody else's tests share it.

## Catalog

A curated collection of public API specs, ready to deploy as simulations. You browse, you pick, you get a URL.

## Portable and codegen

The two ways to ship a simulation from a repo. Portable packs your specs as they are; portable because the same package runs anywhere, our cloud, your laptop, Docker. The package is a `.mockz` file, and any simulation can be downloaded as one and run locally. Codegen generates typed Go handlers from your spec for you to add real logic to; the name is what it literally does.

See Portable simulations (topic `simulations/portable-simulations`) and Codegen simulations (topic `simulations/codegen-simulations`).
