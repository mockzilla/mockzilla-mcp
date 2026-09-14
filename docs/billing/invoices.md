# Invoices

Every payment your organization makes is recorded under **Billing**, on the **Invoices** tab. It is where to check what you were charged and when, and where to get a copy for whoever handles your accounts.

Only owners can see it.

## What lands on one invoice

Your subscription is billed once per period, and everything riding on it is a line on that same invoice: the plan itself, any recurring top-ups, and any providers your organization holds.

A one-time top-up is a separate payment rather than part of the subscription. It gets an invoice of its own, so it turns up in the same list.

See Request top-ups (topic `billing/request-top-ups`) and Backend add-ons (topic `billing/backend-add-ons`).

## Reading the list

The tab shows the 20 most recent invoices, newest first.

- **Invoice** is the number it was given. A very new one may not have a number yet and shows the start of its id instead.
- **Date** is when it was raised, in the date format and timezone set on your account.
- **Amount** is what was paid, with the currency.
- **Status** is **Paid** for a settled one, **Open** for one still owed, **Draft** for one not yet issued, and **Void** or **Uncollectible** for one written off. These come from the payment processor and stay in English whichever language you read the app in.

## Opening one

**View** opens the full invoice in a new tab, with its line items and a PDF to download.

**Manage payment**, on the Plan tab, opens the billing portal, which also lists your invoices.

See Plans and limits (topic `billing/plans-and-limits`).

## When the list is empty

A new organization has nothing here until its first payment, and an organization that has never bought anything has nothing to show either.

An organization on the student plan is never charged, so it has none at all.

See Student plan (topic `billing/student-plan`).
