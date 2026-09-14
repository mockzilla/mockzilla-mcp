# Resilient backends overview

A resilient backend is your own copy of a provider's API. It answers on the same paths as theirs, returns the same response shapes and the same status codes, and behaves the way the provider does. Your integration changes its base URL and nothing else.

The word resilient is about ownership. The sandbox is yours alone, it stays up when the provider's is down, and it produces the failures their sandbox will not.

## Why teams run one

- A vendor sandbox sits outside the production SLA. When it goes down, your release waits, and there is nobody to call.
- Your whole company usually shares one vendor account. What another team does in it shows up in your build.
- Some providers only hand out sandbox credentials after a sales call, and a few never for the API you need.
- The cases worth testing are the ones a vendor sandbox will not produce on demand: a stolen card, a sanctions hit, an issuer that times out.
- Flows that send a person to a page and wait there cannot be automated against the real thing.

## Types

A type is a family of providers with one engine behind it. These are available today.

**Payments.** Card and wallet providers. Authorise, capture, partially capture, refund, cancel, adjust an authorisation, plus 3D Secure and idempotency keys.

See Payments sandbox overview (topic `backends/payments-overview`).

**Identity.** Verification of people and companies, KYC and KYB together, because the providers treat them as one thing. Document and selfie checks, watchlist screening, business registration and ownership, and the hosted flows that normally need a person.

See Identity sandbox overview (topic `backends/identity-overview`).

## You decide what comes back

Name the subject of a request after the outcome you want and that is what you get. Call the cardholder `insufficient_funds` and the payment is refused for that reason. Call the applicant `sanctions_match` and the check comes back with the hit on the report that would have found it.

The triggers are the same words on every provider, and each one answers in its own format. You write the test once, and adding a second vendor does not mean learning a new set of magic values. Each provider also keeps its own published test data, so the card numbers and reserved names from its documentation work here too.

When the built-in triggers do not cover a case, write your own. A scenario says what a request looks like and what should come back, and it sits on top of what we ship rather than replacing it.

See Write your own scenarios (topic `backends/write-your-own-scenarios`).

## How it fits together

Providers belong to your organization. You add the brands you want once, and every sandbox you run can serve them.

See Add providers (topic `backends/add-providers`).

A sandbox is a deployed simulation with a URL of its own. You pick which of your organization's providers it serves.

You can run more than one, and each keeps its own records. Point CI at one and keep another for testing by hand.

See Create a sandbox (topic `backends/create-a-sandbox`).

The address follows the same pattern as every other simulation:

```
https://<domain>/pay/<your-org>/<name>    # payments
https://<domain>/kyx/<your-org>/<name>    # identity
```

Under that, each provider answers on its own prefix, which includes the API and the version:

```
https://<domain>/pay/<your-org>/<name>/adyen/checkout/v71/payments
https://<domain>/kyx/<your-org>/<name>/onfido/v3.6/applicants
```

Everything after the prefix is the provider's own path, so your client library keeps working as it is.

Because it is a simulation, the rest of the app works on it as usual: request history, replays, access control and share links. On top of that it keeps a record of what it has done, such as the payments taken, or the cases, subjects and documents filed.

See Sandbox activity (topic `backends/sandbox-activity`).

We publish new builds of each type, adding providers and fixing behaviour. A sandbox follows the latest build unless you pin it to one, and a pinned sandbox stays there until you move it yourself.

See Pin a build version (topic `backends/pin-a-build-version`).

## What you need

Sandboxes run on the plans that include them, and they need a certain amount of memory to run at all. The app tells you where you stand before you buy anything, and points you at plans if your current one cannot host them.

Your first order of each type runs free for a trial period. Nothing is charged until it ends, and cancelling inside it costs nothing. Providers are added to the subscription you already have, so there is no separate checkout. Organization owners buy and remove them; everyone else can use what the organization holds.

## Where to go next

- Add providers (topic `backends/add-providers`)
- Create a sandbox (topic `backends/create-a-sandbox`)
- Payment scenarios (topic `backends/payment-scenarios`)
- Identity scenarios (topic `backends/identity-scenarios`)
