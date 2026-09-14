# Audit log

The audit log records everything that changed your organization, and who changed it. Open **Audit log** in the sidebar. Owners and admins can read it, and it is not in the sidebar for anyone else.

(Image: Six rows of the audit log: two people, one API key, one from support and one with no person behind it.)

*The audit log*

## What a row says

- **Who** names the actor, with a sentence saying what they did. A name in the sentence links to the thing itself.
- **Action** is the code for that kind of change, the same code however it was made.
- **IP address** is where the call came from.
- **When** is the timestamp, in your own format and timezone.

The sentence carries the fields that changed and their new values. Secrets are the exception. A row says the API key changed. It does not say what it changed to.

## Who shows up

- **You and your teammates**, for anything done in the app.
- **An API key**, when a script or a CI job did it. The key's name sits under the sentence.
- **Mockzilla Support**, when we change something on your behalf. These rows carry no address.
- **Mockzilla**, for what nobody clicked: a renewal, a failed payment, a trial ending. No address on these either.

See API keys (topic `settings/api-keys`).

## What is recorded

Members and their roles, invitations, API keys, simulations and sandboxes, specs and replays, access settings, single sign-on and its domains, the plan and what it is billed for.

Sign-ins are not. A sign-in belongs to a person rather than to an organization, and someone in three organizations would file three rows for one.

The requests your simulations answer are not here either. That is the History view, per simulation.

See Request history (topic `simulations/request-history`).

## Finding a row

**Period** narrows the list to the last 24 hours, 7, 30 or 90 days, or a range you set. The pages walk back from the newest.

Nothing expires. The log goes back as far as your organization does.
