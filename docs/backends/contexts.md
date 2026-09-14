# Change values with contexts

A scenario decides what happens. A context decides what the values look like.

Every provider ships one, so a sandbox answers with vendor-shaped data as soon as it runs: a statement descriptor in the format Stripe uses, references that look like that vendor's references, currencies it actually settles in. A context of your own replaces the parts of that you care about.

## When you need one

The built-in values are realistic but generic. Write a context when your tests, your fixtures or your screenshots need the values to be yours:

- Your own merchant account, store or account identifiers, so responses match what your staging system expects.
- A currency list narrowed to the ones you actually sell in.
- Reference formats your parsing or reconciliation code already assumes.

## Where they live

Open the sandbox, go to **Contexts**, pick a provider and use the **This sandbox** tab.

(Image: A context of the sandbox owner's own, replacing three of the values the provider ships.)

*A context of your own, replacing three of the values a provider ships.*

The document is a map of field names to values. A name matches that field wherever it appears in a response, at any depth, so `currency` covers every currency field the provider returns. Nest a name under an object to scope a common word like `name`, `code` or `value` to one place.

Only the names you write are replaced. Everything else falls through to what the provider ships, so a three-line document is a perfectly good context.

## Seeing what you are layering on

The **Shipped** tab shows the provider's own context: the names worth replacing, and the formats they come in. Read it before you write over part of it.

(Image: The context a provider ships, which is the list of names worth replacing.)

*The provider's own context, with the names you can replace.*

**Copy this document** takes the whole thing across to your tab, which is the easy way to start from something that works.

## Scope

A context belongs to a provider scope: a brand, one API of it, or one exact version.

Every scope that matches applies, narrowest first. A name written at the version level wins for that name, and the brand context still supplies every name the version one leaves out.

Write the values that hold for a vendor at the brand, and reach for a version only where that version genuinely differs.

## What is checked

Nothing checks a context when you save it. A scenario is checked against the build's vocabulary before it saves; a context is not, because it is a free-form map of names to values.

The sandbox still holds its answers to the provider's spec. A value that does not fit the field's type, or is not one of the values that field allows, is not used: the sandbox generates one that fits instead. So a context can save cleanly and still produce values you did not write.

A name the provider never returns is not an error either. It simply never matches anything.

If a value does not come back the way you expected, the usual causes are a type or an allowed value the field does not accept, a name that does not appear in that response, or a name so common it needed nesting.

## Making it live

Saving stores the document. **Deploy** puts it on the running sandbox.

Removing the override puts that provider back to the values it ships.

## Where to go next

- Write your own scenarios (topic `backends/write-your-own-scenarios`)
- Sandbox activity (topic `backends/sandbox-activity`)
- Create a sandbox (topic `backends/create-a-sandbox`)
