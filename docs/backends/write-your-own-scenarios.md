# Write your own scenarios

The built-in triggers cover the cases every team needs. Your own scenarios cover the ones only your product has: the refund your finance team argues about, the applicant your risk rules treat differently, the exact response a bug report came in with.

A scenario is a **when** and a **then**: when a request matches what you describe, the sandbox answers the way you said.

## Where they live

Open the sandbox, go to **Scenarios**, pick a provider and use the **This sandbox** tab.

(Image: Two scenarios of the sandbox owner's own, each with what it matches and what comes back.)

*A scenario of your own: what it matches, and what comes back.*

Each row is one scenario: a name, one or more conditions, and the outcome. The name is a label. It comes back with the result so you can tell which rule fired, and it is never matched on.

Conditions in the same row are alternatives. A row matching two names fires when either one arrives, not when both do.

## Which one fires

Three layers, tried in order:

1. Yours
2. What the provider ships
3. The shared set every provider answers to

The first match wins, so writing a scenario for `insufficient_funds` replaces the built-in behaviour for that trigger and leaves everything else alone.

Inside a layer, the sandbox picks by a fixed order of conditions rather than by the order rows appear on screen. That order is on the payment (topic `backends/payment-scenarios`) and identity (topic `backends/identity-scenarios`) pages.

To drop both built-in layers and answer only from your own list, set `replace: true`.

## Writing YAML instead

The editor and the YAML are the same document. Switch to **YAML** for anything the table cannot express, or to paste a scenario a colleague sent you.

(Image: The same two scenarios as YAML.)

*The same scenarios as YAML.*

Switching back to the editor rewrites the document, which drops comments. The app says so before you do it.

The **Shipped** and **Shared** tabs are the obvious place to start: copy an entry that already works and change what you need.

## What is checked before it saves

Your document is checked against the build the sandbox actually runs, not against the newest one. A sandbox pinned to an older build is held to what that build accepts.

The check covers the shape of the document, the outcome names, the reasons that go with them, and the fields you can match on. Anything it cannot accept is reported per row, with the row named, and the save is refused.

## Scope

Each override belongs to one provider scope, at the same three levels a sandbox picks providers: a brand, one API of it, or one exact version. The narrower one wins.

Writing against the brand is usually right. Reach for a version scope when two versions of the same API genuinely need different answers.

## Making it live

Saving stores the document. **Deploy** is what puts it on the running sandbox, the same as any other change.

Removing an override puts that provider back to what it ships.

## Where to go next

- Change values with contexts (topic `backends/contexts`)
- Payment scenarios (topic `backends/payment-scenarios`)
- Identity scenarios (topic `backends/identity-scenarios`)
