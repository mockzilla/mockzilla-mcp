# Roles and permissions

Everyone in an organization holds one role in it: **Owner**, **Admin**, **Editor** or **Viewer**. The role decides what that person can do with the organization's simulations, sandboxes, people and money.

Roles are per organization. Being an owner of one says nothing about your role in another.

## The four roles

- **Owner** runs the organization, the plan and the payments.
- **Admin** runs the team and the settings, but never the money.
- **Editor** builds: simulations, sandboxes, deploys, support.
- **Viewer** reads.

## What each role can do

| Task | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|
| See simulations, history, replays and usage | Yes | Yes | Yes | Yes |
| Read support issues | Yes | Yes | Yes | Yes |
| Create, edit and deploy simulations | Yes | Yes | Yes | No |
| Create and run sandboxes | Yes | Yes | Yes | No |
| Open and answer support issues | Yes | Yes | Yes | No |
| Invite members and change their roles | Yes | Yes | No | No |
| Create and revoke API keys | Yes | Yes | No | No |
| Change the organization name and URL | Yes | Yes | No | No |
| Set the simulation access defaults | Yes | Yes | No | No |
| Read the audit log | Yes | Yes | No | No |
| Set up single sign-on | Yes | No | No | No |
| Buy providers for a sandbox | Yes | No | No | No |
| Change the plan, pay and read invoices | Yes | No | No | No |
| Delete the organization | Yes | No | No | No |

An admin cannot change or remove an owner, and only an owner can hand out the owner role. An organization always keeps at least one owner.

## Roles on a single simulation

Members reach every simulation in the organization at the role they hold there.

You can also share one simulation with someone outside the organization. They get a role on that simulation alone: owner, editor or viewer of it, and nothing else in the organization.

See Share links (topic `simulations/share-links`).

## Roles on API keys

A key carries a role of its own, and it stops at editor. A key can read and deploy. It can never manage people, other keys, or billing.

See API keys (topic `settings/api-keys`).

## Changing a role

Owners and admins change roles in Settings, on the **Members** tab.

See Members and invitations (topic `settings/members-and-invitations`).
