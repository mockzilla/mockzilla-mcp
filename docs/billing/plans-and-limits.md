# Plans and limits

Your plan sets what your organization can run: the traffic it serves, the simulations it keeps, and what each request gets to work with. **Billing** is where you read those numbers, move to a different plan, and manage how you pay.

It has three tabs: **Plan**, **Request top-ups** and **Invoices**.

Only owners see it, and it covers one organization at a time. Switch to the one you mean before you start.

## Your plan

The **Plan** tab opens on what you are on now.

(Image: The Plan tab: the plan name, its price, an Active badge, and a bar showing how much of the current period is left.)

*Your plan, what it costs, and how much of the period is left.*

Beside the name is a badge: **Active**, **Trial**, **Past due**, **Canceled** or **Paused**. Past due means a payment failed and the card needs attention.

**Current period** is the stretch you have already paid for. The bar fills as it runs down, and the two dates are when it started and when it renews.

With nothing set up yet, the tab says so and offers **Choose a plan**.

## What each limit means

The same tab lists what the plan allows.

(Image: The six plan limits as cards: monthly requests, throughput, simulations, refs, memory and timeout.)

*The six numbers your plan is measured against.*

- **Monthly requests**: what all your simulations together can serve in a month. The counter resets on the 1st.
- **Throughput**: how many requests per second they handle at the same moment. Traffic above it is answered with a 429 for a moment.
- **Simulations**: how many you can have. One simulation is one deployment and can host several APIs.
- **Refs**: pull-request-style environments per simulation.
- **Memory**: what each request runs with. A large spec or a heavy response needs more.
- **Timeout**: the longest a single request can run before it is cut off.

To see how much of each you have used, open the panel above your simulations list.

See Usage and limits (topic `simulations/usage-and-limits`).

## Change plan

**Change plan** takes you to the pricing page. Pick a plan there, and use the toggle above the cards to pay monthly or yearly.

Both directions are prorated. Move up and you pay the difference for the days left in the period. Move down and you get credit for the days you did not use.

If none of the plans fit, **Build your own plan** lets you set the limits yourself and prices them as you type.

> Switching to a different plan forfeits any active request top-ups. Moving between monthly and yearly on the same plan keeps them. The app lists what you would lose and asks you to confirm.

See Request top-ups (topic `billing/request-top-ups`).

> If the amount is more than checkout can charge at once, the app says so. Contact us and we will invoice it instead.

## Manage payment

**Manage payment** opens the payment portal in a new tab. Change your card there, read past invoices, or cancel.

Your card is held by Stripe. We never see it, and we cannot take a payment any other way.

## If you cancel

Cancelling stops the renewal. The plan runs to the end of the period you have paid for, and nothing is removed that day.

For 30 days after that your simulations and refs are left alone, in case you come back. Then we trim what no longer fits a free account. Your account itself stays, and you can delete your own data yourself at any point.
