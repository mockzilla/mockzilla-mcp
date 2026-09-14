# Sandbox activity

A sandbox keeps a record of what it has done. Every payment taken, every verification run, browsable in the app without adding anything to your integration.

## Where it is

Open the sandbox. Under **Operations** you get one list per kind of thing that sandbox keeps.

A payments sandbox keeps one: **Payments**. A payment carries its own authorisations, captures and refunds, so there is nothing to join.

(Image: The payments a sandbox has taken, with the search and filters above them.)

*The payments a sandbox has taken, newest first.*

An identity sandbox keeps four: **Cases**, **Subjects**, **Documents** and **Sessions**. A case names the subject it is about and the documents filed for it, so they are separate lists rather than one.

## Reading a list

Every list is newest first and shows the provider each row came from.

- **Payments** show the reference, the amount, the status, the method and the payer.
- **Cases** show the reference, the subject, the status, the decision, the reason and the trigger that produced it.
- **Subjects** show the name, the type, the country and your reference.
- **Documents** show the kind, the subject, the number, where it was issued and when it expires.
- **Sessions** show the case, the status, the outcome and the trigger.

## Finding one

Two ways, and they behave differently.

**Search** takes the identifiers a person actually has to hand: a payment's reference or payer, a case's reference, a subject's name or email, a document's number. Searching for an exact reference finds it whatever the sandbox has done since.

**The filters** narrow what is on screen by status, method, currency, decision, country, document kind or trigger. They offer the values the rows actually contain, so a filter never offers something with no results behind it.

## One provider at a time

A list shows one provider's records, starting with the first provider the sandbox serves. Pick another from the provider control to switch.

## What is not there

Records expire. A sandbox keeps about a day of them, so this is the log of a test run, not an archive to reconcile against.

Only what the sandbox itself recorded is here. A request it refused before it got that far, or traffic to an endpoint that stores nothing, shows up in **History** instead.

See Request history (topic `simulations/request-history`).

If a list says it cannot be read, the sandbox has usually not deployed yet.

## Where to go next

- Payment scenarios (topic `backends/payment-scenarios`)
- Identity scenarios (topic `backends/identity-scenarios`)
- Create a sandbox (topic `backends/create-a-sandbox`)
