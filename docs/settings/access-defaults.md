# Access defaults

Set the access rules once and every simulation in the organization gets them. They live in Settings on the **Simulation Access** tab, and owners and admins can edit them.

(Image: The organization's access defaults: an API key, explorer credentials and an IP allowlist.)

*The organization's access defaults*

## What you can set

- **API key** required on the mock API, in the `x-mockzilla-api-key` header.
- **Basic auth** on the API explorer, as a username and a password.
- **IP allowlist** over both, as addresses or CIDR ranges.

The fields behave the same here as on a simulation, down to the option to store the explorer password as a SHA-256 hash.

See Access control (topic `simulations/access-control`).

> The IP allowlist is part of plans that include it. Without it the field is locked.

## What a simulation does with them

A simulation with nothing of its own uses the organization's value, and its Access page marks the field.

(Image: The API key field on a simulation, marked as the organization default, with an override action.)

*A field on a simulation, taking the organization's value*

**Override** gives that simulation its own value, for that field alone. The others keep following the organization.

**Revert to organization default** on an overridden field clears it and hands the field back.

Inheritance is per field, so a simulation can carry its own API key while the explorer password and the allowlist stay organization-wide.

## When it takes effect

On each simulation's next deploy. Saving here changes nothing that is already running.
