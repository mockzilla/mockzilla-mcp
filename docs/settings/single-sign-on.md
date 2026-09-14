# Set up single sign-on

An organization can put its members behind its own identity provider. They sign in there and land in the organization with the role you decide.

Setup is on the **Single sign-on** tab in Settings. Owners and admins can read it. Only owners can change it.

> Single sign-on is part of plans that include it. The tab lists the providers either way.

## Pick a provider

(Image: The identity provider catalogue, with nine providers to choose from and one of them active.)

*The identity providers on offer*

Nine to choose from: Okta, Google Workspace, GitHub, Microsoft Entra ID, Auth0, OneLogin, JumpCloud, Rippling and Keycloak.

An organization runs one at a time. Configuring a second replaces the first.

Press **Configure** on the one you use.

## Fill in the connection

(Image: The provider form: issuer URL, client ID and client secret above, the enforcement settings below.)

*The Okta form, with the connection above and the member rules below*

Most of the providers speak OpenID Connect and ask for three things:

- **Issuer URL** is your tenant's OpenID issuer. We read its discovery document for the rest.
- **Client ID** comes from the application you create for Mockzilla.
- **Client secret** is stored encrypted and never shown again. Leave it blank to keep the one you saved.

Point that application at this callback:

```
https://app.mockzilla.org/auth/callback/sso
```

**Google Workspace** is shorter: it takes a Workspace domain instead of an issuer, and only accounts in that Workspace can sign in.

**Save** stores the connection. **Remove configuration** takes the provider away again.

## GitHub

GitHub asks for no issuer and no secret. It runs on our own OAuth app and authenticates the members of one GitHub organization.

(Image: The GitHub provider form: install the app, connect your account, then pick the organization.)

*The GitHub form, with the two steps that fill its organization list*

1. Follow **Install the Mockzilla GitHub App** and install it on the GitHub organization whose members should sign in.
2. Follow **Connect your GitHub account**, which takes you to Connected accounts.
3. Come back and pick the organization under **GitHub organization**, then press **Save**.

Only active members of that organization can sign in. Someone who leaves it is refused the next time they go through the provider.

## Set the rules

The lower half of the same form decides what the provider means for your members.

- **Require single sign-on** refuses the organization to anyone who has not come through the provider. You can only switch it on after at least one member has, so an organization cannot lock itself out.
- **Force re-authentication** asks the provider to challenge the member instead of handing back a session it already has.
- **Re-authentication interval** is how many hours an identity stays good before the member goes through the provider again. Between 1 and 720, and 24 to start with. Identity providers do not tell us when they switch an account off, so this interval is what bounds a deactivated member's access.
- **Default role for new members** is what a first arrival through the provider gets: viewer, editor or admin.

See Roles and permissions (topic `settings/roles-and-permissions`).

## Verify your email domains

(Image: The email domains panel: one domain verified, one showing the TXT record it is waiting for.)

*Two domains, one verified and one waiting for its record*

A verified domain routes sign-ins. Someone typing an address at that domain on the sign-in page is sent to your provider.

1. Type the domain and press **Add domain**.
2. Publish the TXT record it shows you. The name is `_mockzilla.` followed by your domain, and the value starts with `mockzilla-domain-verification=`.
3. Press **Verify**. A new record can take a few hours to show up in public DNS.

An organization can hold up to 3 domains. Each domain belongs to one organization, and public mail hosts are refused.

GitHub is the exception: it authenticates a GitHub account, whose address can be anything, so domains do not route to it.

## How members sign in

On the sign-in page they pick **Sign in with SSO** and give either their work email address or the organization's name.

Someone already signed in connects from their own settings instead, on the Connected accounts tab.

See Connected accounts (topic `settings/connected-accounts`).
