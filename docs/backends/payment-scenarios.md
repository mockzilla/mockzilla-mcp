# Payment scenarios

A vendor sandbox decides what your payment does. Here you decide, by naming the payment after the outcome you want.

Call the cardholder `insufficient_funds` and the payment is refused for that reason, in the PSP's own code. Call them `approve` and it goes through, whatever card number you sent.

## Name the cardholder

The cardholder name is the first thing checked, and it is matched without regard to case. Use `approve` for a clean authorisation, or any of these refusals:

- Card state: `expired_card`, `invalid_card`, `blocked_card`, `restricted_card`, `lost_card`, `stolen_card`
- Money: `insufficient_funds`, `withdrawal_amount_exceeded`, `invalid_amount`
- Fraud and checks: `fraud`, `acquirer_fraud`, `issuer_suspected_fraud`, `avs_declined`, `cvc_declined`
- Refused or routed away: `declined`, `referral`, `transaction_not_permitted`, `not_supported`, `not_3ds_authenticated`
- The other side failing: `acquirer_error`, `issuer_unavailable`

Every provider answers to the same words and returns its own code for them. You write the test once, and adding a second PSP does not mean learning a second vocabulary.

## Payments that carry no name

Wallets, stored cards and PayPal have no cardholder to name. Two other triggers reach them:

- The payer email `declined@example.com` for a plain refusal, or `nobalance@example.com` for insufficient funds.
- The amount `99`, in whatever currency you are sending, also for insufficient funds.

## 3D Secure

Four names put a card payment through authentication instead of authorising it outright:

- `require_3ds` stops at a challenge.
- `require_3ds_frictionless` passes authentication with no challenge at all.
- `require_3ds_fingerprint` collects a device fingerprint first, then challenges.
- `require_3ds_fingerprint_frictionless` collects the fingerprint and then passes.

A provider that does not offer 3D Secure approves these instead of failing, so the same test can run against a PSP that has no such flow.

See Payments sandbox overview (topic `backends/payments-overview`) for what the challenge itself looks like.

## The vendor's own test data

Each PSP keeps the values from its own documentation on top of the shared set. Adyen's `DECLINED`, `REFERRAL` and `CARD_EXPIRED` cardholder names work, and so do its published test card numbers and BIN prefixes. If your team already has a page of vendor test cards, they keep working here.

## Which trigger wins

A payment takes the first trigger that matches, in this order:

1. Cardholder name
2. Payer email
3. Card number
4. Amount
5. Card BIN prefix
6. Payment method

The order is what makes a name useful. A name beats a card number, so naming the cardholder `approve` pushes through a card that would otherwise be refused, and naming them `stolen_card` refuses a card that would otherwise sail through.

## Seeing what a provider answers to

You do not have to keep this page open to know what a sandbox will do. Open the sandbox, go to **Scenarios**, and pick a provider.

(Image: The Shipped tab: what one provider answers to before you change anything.)

*What one provider answers to before you change anything.*

**Shipped** is what that provider brings, its own test cards and reserved names included.

**Shared** is the baseline every provider in every sandbox answers to, which is the list at the top of this page.

(Image: The Shared tab: the triggers every provider in the sandbox answers to.)

*The baseline every provider answers to.*

Both are read-only. They are there to be read and copied from.

## When the built-in list is not enough

Write your own. A scenario says which requests it matches and what should come back, and yours are tried before anything shipped.

See Write your own scenarios (topic `backends/write-your-own-scenarios`).

## Where to go next

- Write your own scenarios (topic `backends/write-your-own-scenarios`)
- Payments sandbox overview (topic `backends/payments-overview`)
- Sandbox activity (topic `backends/sandbox-activity`)
