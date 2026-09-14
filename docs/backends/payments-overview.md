# Payments sandbox overview

A payments sandbox is your own copy of a payment provider's API. These providers are usually called PSPs, short for payment service provider, and the app uses that word too.

The sandbox takes the calls your integration already makes, on the same paths, and answers in the PSP's own shapes and status codes.

What makes it useful is that it keeps state. Authorise a payment, capture it in a later call, then refund part of it, and it stays one payment throughout, not three unrelated responses.

That state is deliberately short-lived. A payment and its history stay for about a day, a hosted checkout session for 15 minutes, and a 3D Secure challenge for 5. That is long enough for a test run or an afternoon of debugging, and it is not somewhere to keep records.

## The payment lifecycle

A payment moves through the states the vendor uses:

- **Authorise** puts a hold on the money. A payment that needs no separate capture is settled at once, the way some providers work.
- **Capture** takes it. Capture the whole amount, part of it, or several times up to what was authorised.
- **Refund** gives it back, in full or in parts.
- **Cancel** releases an authorisation that was never captured.
- **Adjust** raises or lowers an authorisation before capture.

Two edges are modelled because real integrations hit them: refunding a payment that was never captured, which cancels it instead, and cancelling one that was already captured, which refunds it instead. A zero-amount authorisation for card verification works too.

Not every PSP does all of this, and the sandbox does not pretend otherwise. Each brand declares what it supports, version by version, and the app shows it on the brand's **Overview** tab as capabilities such as `capture`, `partialCapture`, `partialRefund`, `threeDS` and `idempotency`.

## 3D Secure without a person

Card payments that need authentication run the full 3DS2 flow. Depending on what you ask for, a payment can:

- pass frictionlessly, with no challenge at all,
- collect a device fingerprint first, and let that decide whether the payer is challenged,
- or stop at a challenge, as a one-time code, a redirect, or an approval in a banking app.

The sandbox serves the challenge page itself, so a test can drive it to the end. This is the part that is usually impossible to automate against a vendor sandbox, because a human has to click something.

(Image: The 3D Secure challenge page a payments sandbox serves, with the code shown instead of sent.)

*The challenge page, with the code shown on it rather than sent to a phone.*

## Methods that leave your site

Wallets, bank redirects and local methods send the payer somewhere and wait for them to come back. The sandbox serves that page too, and the payment sits in a pending state until it is approved or cancelled, exactly as it would in production. Providers with a hosted checkout page work the same way: you create the session, you get a URL, and finishing it settles the payment.

## Idempotency keys

Send the same idempotency key twice and you get the first result back rather than a second charge, on the providers that support it. It is one of the harder behaviours to test anywhere else, since it needs a vendor that actually remembers your key.

## What comes back

Response bodies, field names and HTTP status codes are the PSP's. A client library written for the vendor works unchanged, which is the whole point: you change a base URL and nothing else.

Each payment carries its own history, so its captures and refunds are part of it rather than separate records to stitch together. You can browse them in the app by reference, amount, status, method or payer.

See Sandbox activity (topic `backends/sandbox-activity`).

## Deciding what happens

You are not waiting to see what the sandbox feels like doing. Name the cardholder, the payer email or the amount after the outcome you want, and that is what comes back, in the provider's own decline code.

See Payment scenarios (topic `backends/payment-scenarios`).

## Where it answers

Each provider is mounted under its own prefix, which carries the brand, the API and the version:

```
https://<domain>/pay/<your-org>/<name>/adyen/checkout/v71/payments
```

Everything after the prefix is the provider's path. One sandbox can serve several providers at once, each under its own prefix.

(Image: The providers a sandbox serves, each with the number of endpoints it answers.)

*A sandbox serving several PSPs, each with the endpoints it answers.*

See Create a sandbox (topic `backends/create-a-sandbox`).

## Where to go next

- Payment scenarios (topic `backends/payment-scenarios`)
- Add providers (topic `backends/add-providers`)
- Write your own scenarios (topic `backends/write-your-own-scenarios`)
