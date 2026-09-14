# Add providers

A provider is a brand your organization holds, such as Adyen or Onfido. You add it once, and every sandbox in the organization can serve it. This page is about adding one and giving it back.

Adding a provider does not create anything that answers requests. That is the next step.

See Create a sandbox (topic `backends/create-a-sandbox`).

## What a brand covers

You buy a name, not a version. Holding Adyen covers every Adyen API and every version of it that the current build ships, so a sandbox pinned to an older build is entitled to what that build served.

What you hold belongs to the organization, not to a sandbox or a person. Which sandbox serves which brand is a separate choice you make per sandbox, out of what the organization holds.

## Find a provider

Open **Backends** in the app. Under **Providers** you get every brand we ship, with a search box and filters for type, region and method.

(Image: The provider list, with one brand owned and one dropped from the current build.)

*Every brand we ship, with what it covers, what it costs, and what your organization already holds.*

The table shows what each brand covers: its type, the regions and countries it is used in, its methods, and how many endpoints it answers. Methods are what the brand works with. For a payment brand they are cards and wallets. For an identity brand they are the checks it runs, such as Document or Watchlist.

Open a row for the detail. It has two tabs:

- **Overview** lists the brand's APIs, the versions under each one, and what every version can do.
- **Endpoints** lists the routes themselves, so you can check that the calls your integration makes are there before you pay for anything.

(Image: A brand's detail: its APIs and versions, what each version can do, its methods and its coverage.)

*A brand's APIs and versions, with what each version can do.*

(Image: The Endpoints tab, listing every route the brand answers.)

*The Endpoints tab, route by route.*

Two labels in the table are worth knowing:

- **Owned** means your organization already holds the brand.
- **Not in the current build** means the brand exists, but this build does not ship it. It cannot be added or deployed until a build brings it back.

## Place the order

Tick the brands you want. A bar appears at the bottom with the count and the total, and **Add providers** places the order.

(Image: Ticking brands builds one order, with the count and the total.)

*Two brands picked, priced as one order.*

An order covers one type. Ticking a payment brand while identity brands are selected starts a new selection instead of mixing them. The free trial is per type, so a mixed order would be part free and part billed.

There is no separate checkout. Providers join the subscription your organization already has, so they are billed on the same period as that subscription. If yours renews yearly, a provider is charged once a year, not every month.

The app shows what each brand costs, and the total, before you confirm.

(Image: The confirmation before anything is charged.)

*Nothing is charged until you confirm.*

Only organization owners can add or remove providers. Everyone else sees what the organization holds and can use it.

> If your order is larger than checkout can charge at once, the app says so. Contact us and we will invoice it instead.

## The free trial

Each type has one free trial per organization. Your first order in that type runs free for the period shown on the **Types** row. Nothing is charged while it runs, and cancelling before it ends costs nothing. Whatever you still hold when the trial ends starts being billed then.

(Image: Each type with its free trial and the providers already held.)

*Each type carries its own trial.*

Each type's trial is its own. Spending the payments one leaves identity untouched. An order in a type whose trial is already spent is billed from the start.

## What you hold

The top of the page lists your providers with a status each.

(Image: The providers an organization holds, one line each with its status.)

*One line per brand the organization holds.*

- **Trialling.** Inside the free trial, not yet billed.
- **Active.** Billed with the rest of your subscription.
- **Suspended.** Your plan no longer covers backend sandboxes, so billing stopped and the sandboxes came down. Nothing was lost. Upgrading again brings the brands back at the price you were paying.

## Remove a provider

Use the bin icon next to a provider and confirm.

(Image: Removing a provider says what will happen before you confirm.)

*The confirmation spells out what removing does.*

Billing stops at once, and the rest of the period you already paid for is not refunded. The brand is taken off every sandbox that served it, and those sandboxes redeploy without it. A sandbox left with no providers at all is taken offline, since there is nothing left for it to answer. Bring it back online after you give it a provider again.

Adding the brand again later is a fresh order at whatever it costs then, and the trial for that type is not offered a second time.

## Where to go next

- Create a sandbox (topic `backends/create-a-sandbox`)
- Pin a build version (topic `backends/pin-a-build-version`)
- Resilient backends overview (topic `backends/overview`)
