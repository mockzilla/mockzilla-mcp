# Identity scenarios

You decide how a verification turns out by naming the person or the company after the outcome you want.

Call the applicant `sanctions_match` and the case comes back refused, with the hit on the screening check rather than on the document one. Call them `approve` and everything passes.

## Name the subject

The name is checked first, without regard to case, and it matches in full or on its last word. So `sanctions_match` and `Jane sanctions_match` both work, which matters when a form insists on a first name.

Use `approve` for a clean pass, or any of these refusals:

- Documents: `document_expired`, `document_not_supported`, `document_unreadable`, `document_tampered`, `document_type_mismatch`
- Face and liveness: `face_mismatch`, `face_not_detected`, `liveness_failed`
- Screening: `sanctions_match`, `pep_match`, `adverse_media_match`, `watchlist_match`
- Declared data: `data_mismatch`, `identity_not_found`, `address_not_verified`, `phone_not_verified`, `email_not_verified`, `underage`
- Businesses: `business_not_found`, `business_inactive`, `ownership_not_verified`, `tax_id_mismatch`
- Risk: `device_risk`, `blocklisted`, `duplicate_subject`

Every refusal lands on the check that owns it. Asking for a document check and a watchlist check on an applicant named `pep_match` gives you a clean document report and a refusal on the screening one, which is the shape your parsing code has to handle in production anyway.

## Outcomes other than pass and fail

Three names produce the states that are hardest to reproduce anywhere else:

- `review` returns a case a human is supposed to look at. Every check runs, and the one it names comes back inconclusive rather than failed.
- `pending` returns a case that does not answer yet. It stays running until it is read again or resumed, which is what a polling integration is written against.
- `hosted` returns a case waiting for the subject to complete the capture themselves. Follow the link in the response and finish it there.

A provider without a hosted flow approves `hosted` instead, so the same test still runs.

## Subjects you did not name

A hosted capture, an SDK flow or an imported subject arrives with a name you did not choose. Four other triggers reach those:

- Email `declined@example.com`, `sanctioned@example.com`, `review@example.com` or `pending@example.com`.
- Date of birth `2015-01-01`, for someone too young to pass.
- Country `KP`, for a subject declaring a sanctioned country. Write it as two letters, three letters or the numeric code: all three reach the same trigger, whichever form the provider records.
- Your own reference, where the provider takes one.

## The provider's own test data

Each provider keeps the values from its own documentation. Onfido's `clear` and `consider` applicant names work, along with the document numbers its sandbox publishes. Persona answers to `pass` and `fail`, and to references like `test-declined`.

## Which trigger wins

A case takes the first trigger that matches, in this order:

1. Name, in full or by its last word
2. Email
3. Your own reference
4. Document number
5. Date of birth
6. Country
7. Check type

## Seeing what a provider answers to

Open the sandbox, go to **Scenarios** and pick a provider.

(Image: The Shipped tab: what one identity provider answers to before you change anything.)

*What one identity provider answers to before you change anything.*

**Shipped** is that provider's own set.

**Shared** is the baseline every provider answers to, which is the list at the top of this page.

(Image: The Shared tab: the triggers every identity provider answers to.)

*The baseline every identity provider answers to.*

Both are read-only, and both are there to copy from.

## When the built-in list is not enough

Write your own. Yours are tried before anything shipped.

See Write your own scenarios (topic `backends/write-your-own-scenarios`).

## Where to go next

- Write your own scenarios (topic `backends/write-your-own-scenarios`)
- Identity sandbox overview (topic `backends/identity-overview`)
- Sandbox activity (topic `backends/sandbox-activity`)
