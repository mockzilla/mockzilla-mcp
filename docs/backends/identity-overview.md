# Identity sandbox overview

An identity sandbox is your own copy of an identity provider's API. It runs verification the way the provider does, on the same paths, and answers in the provider's own report shapes.

KYC and KYB are one product here, because the providers treat them that way. The same case machinery verifies a person or a company, and the checks differ rather than the API.

## What it keeps track of

- A **subject** is the person or company being verified. It outlives any one case, so a returning customer is the same subject.
- A **document** is evidence filed against a subject. It is filed once and can be cited by more than one case.
- A **case** is one verification, and the checks live inside it.
- A **session** is a hosted capture, for the steps the subject completes themselves.

All of it is short-lived on purpose. Subjects, cases and documents stay for about a day, and a hosted link is openable for 30 minutes. That is a test window, not a record store.

## The checks

A case runs the checks you ask for, and each one comes back with its own result:

- Documents and biometrics: `document`, `facial_similarity`, `liveness`
- Declared data: `identity_database`, `proof_of_address`, `phone`, `email`, `device`
- Screening: `watchlist`, covering sanctions, politically exposed persons and adverse media
- Businesses: `business_registration`, `business_ownership`, `tax_id`

Providers differ in what they offer, and the sandbox follows the provider rather than flattening them. Each brand declares its capabilities version by version, and the app shows them on the brand's **Overview** tab.

## What a case answers

A finished case carries a decision: **approved**, **declined**, or **review** when a human is supposed to look at it. Before that it can be processing, waiting on the subject, paused for a reviewer, withdrawn, or expired because nobody finished it in time.

The decision is not the whole answer. Each check reports its own result, with the sub-results and breakdowns the provider publishes, and a watchlist check carries the matches it found. A refusal lands on the check that would have caught it, so a sanctions hit fails the screening check rather than the document one. Parsing code written for the vendor keeps working.

## Businesses as well as people

A company is a subject like any other. Registry lookups, ownership verification and tax-ID checks run in the same case machinery as a document or a selfie, and come back in the same report shape. Nothing about your integration changes between verifying a director and verifying the company they run.

## Flows the subject finishes

Some steps hand the subject a link or a token and wait: an SDK token, a form URL, a one-time link. The sandbox serves that page itself, so a test can open it, complete it and carry on. Until the subject submits the page, the case has no result. When they do, it gets one.

(Image: The hosted capture page a subject completes, served by the sandbox itself.)

*The page the subject finishes, served by the sandbox.*

Nothing is pushed to you, so a test polls. Reading a case that is still waiting is what finishes it, so the next read gets the answer.

## After the decision

The parts of the lifecycle that come after an answer are modelled too, where the provider has them: standing screening that reports a new hit on an old case, a reviewer overriding a decision, restarting a case that stopped part-way, running a finished check again on the same evidence, and erasing a subject's personal data in place.

## What you can browse

Identity keeps four things you can read in the app: cases, subjects, documents and sessions. A case refers to the subject it is about, so they are separate lists rather than one.

See Sandbox activity (topic `backends/sandbox-activity`).

## Deciding what happens

Name the person or the company after the outcome you want, and the case comes back that way, on the check that owns it.

See Identity scenarios (topic `backends/identity-scenarios`).

## Where it answers

Each provider is mounted under its own prefix, carrying the brand and the version:

```
https://<domain>/kyx/<your-org>/<name>/onfido/v3.6/applicants
```

Everything after the prefix is the provider's own path.

See Create a sandbox (topic `backends/create-a-sandbox`).

## Where to go next

- Identity scenarios (topic `backends/identity-scenarios`)
- Add providers (topic `backends/add-providers`)
- Write your own scenarios (topic `backends/write-your-own-scenarios`)
