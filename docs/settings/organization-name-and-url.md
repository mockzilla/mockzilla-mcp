# Organization name and URL

An organization has a name and a URL slug. Both are public, and both live in Settings on the **Danger Zone** tab. Owners and admins can change them. Everyone else gets a note naming who to ask.

(Image: The organization name and URL form, with a new slug typed in and marked as available.)

*Organization name and URL, with a new slug being checked*

**Save** applies both fields. **Cancel** puts them back.

## Name

The name people see: the organization switcher, the members list, the invitations you send. Up to 200 characters, and anything you like.

## URL slug

The slug is the second part of the address of every simulation you build in the app:

```
https://api.mockz.io/app/<org-slug>/<simulation>
```

It takes 2 to 32 characters: lowercase letters, digits and hyphens. It has to be free across all of Mockzilla, and a few words are reserved. The field checks as you type and marks the answer beside it.

Simulations deployed from GitHub are not affected. They answer under the repository they come from.

See Simulations from GitHub (topic `simulations/github-simulations`).

## When the slug locks

Every organization starts with a slug worked out from its name.

The field locks once the organization has a simulation built in the app. The form says so where the hint usually is.

**Pick the slug early.** While there are no app simulations, you can change it as often as you like.
