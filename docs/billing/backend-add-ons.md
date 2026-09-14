# Backend add-ons

A provider is an add-on to your subscription. Your organization buys a brand once, say Adyen, Stripe or Mercado Pago, and every sandbox it owns can serve it. The charge sits on the plan you already pay for.

This page covers what that costs and when it is charged. It works the same for every type of provider. Payments and identity are the two available today.

For finding brands and placing an order, see Add providers (topic `backends/add-providers`).

## What you are charged for

You buy a brand, not a version and not a quantity. That is one line on your bill per brand, held by the organization for as long as you keep it.

One brand covers every API under that brand and every version of those APIs. A version that arrives in a later build is included, and so is an older one still served by a build you have pinned a sandbox to. The price does not move either way.

Each brand carries its own price, and they differ. The providers list shows what each one costs, and the order shows the total, before you confirm anything.

## When you are charged

There is no separate checkout. An order joins the subscription you already have, so it lands on the same invoice and renews on the same day.

The period follows your plan. Pay monthly and a brand is charged every month. Pay yearly and it is charged once a year, at the yearly figure.

Your first order in each type runs free for a trial period. Nothing is charged while it runs and nothing appears on your invoice, so cancelling before it ends costs you nothing. Whatever you still hold when it ends starts being billed then.

Each type has its own trial and each is a one-off. Using up the one for payments leaves every other type untouched, and a second order in a type you have already trialled is billed from the start.

## If a price changes

A brand's price can change. A change applies to orders placed after it, not to a brand you are already holding, so a new list price does not move your existing charge by itself.

Remove a brand and add it again later and that is a new order, at whatever it costs then.

## Removing one

Billing stops the moment you remove it. The rest of the period you have paid for is not refunded.

Removing Adyen also takes it off every sandbox that was serving it. Those sandboxes are deployed again without it, and calls to Adyen stop working.

## If your plan stops covering it

A plan that no longer covers sandboxes suspends what you hold instead of cancelling it. Billing stops, your sandboxes come down, and nothing you picked is lost.

Move back to a plan that covers them and the brands resume at the price you were paying. If you switched between monthly and yearly billing in the meantime, they resume at the current price for that period.

## What your plan has to allow

> Running a sandbox requires a plan that covers them, and enough memory to start one.

Without both, the providers list says so and nothing on it can be added.

See Plans and limits (topic `billing/plans-and-limits`).
