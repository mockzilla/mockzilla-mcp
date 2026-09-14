# Access control

A deployed simulation answers at a public URL. **Access and Variables**, under Settings in the sidebar, decides who can call it: a key on the mock API, credentials on the API explorer, an IP allowlist over both. The same page carries the environment variables the runtime receives.

(Image: The Access and Variables page: API key, basic auth for the explorer UI, the locked IP allowlist and environment variables)

*The Access and Variables page*

Changes save with **Save** and apply on the simulation's next deploy; **Deploy now** sits right beside the note. An organization can also set these values once for all its simulations: a field carrying the **Organization default** badge comes from there, and what you set on the simulation overrides it field by field.

## API key

The API key protects the mock endpoints themselves. With a key set, every request to the simulation must carry it in the `x-mockzilla-api-key` header; a request without it gets a 401. Leave the field empty and the API is open.

```bash
curl "https://api.mockz.io/app/your-org/your-sim/petstore/pets" \
  -H "x-mockzilla-api-key: your-key"
```

The key is stored as you typed it and can be shown again behind the eye icon: it guards mock traffic, not production data. The deployed simulation never holds the key itself, only a digest of it.

## The API explorer: off, open, or behind a password

Every simulation can serve a browsable UI at its URL. Whether it should is a per-simulation call, made with **Serve the API explorer** under **General**:

(Image: The API explorer card under General with the Serve the API explorer toggle on)

*The API explorer toggle under General*

- **You do not need it**: switch it off. The simulation serves only the API, with no UI. The fewer doors, the better.
- **You use it, but not everyone should**: leave it on and set **Basic auth (explorer UI)**. The browser asks for the username and password. The mock endpoints are not affected, so machine traffic keeps working, with the API key if one is set.
- **Anyone with the link may look**: leave it on with no credentials. That is the default.

The explorer is worth keeping around: it lists every service and endpoint, fires requests and shows the response, hands you the matching curl command, and lets you browse recent history in place.

See Request history (topic `simulations/request-history`).

### A password that is never stored

The password field has two modes. **Password** stores what you type, like the API key. Switch to **SHA-256 hash** to paste a 64-character digest instead: the simulation can verify against it, and nobody, us included, can read the password back.

(Image: The basic auth row with SHA-256 hash mode selected and a 64-character digest filled in)

*The explorer password entered as a SHA-256 hash*

Generate the digest locally:

```bash
echo -n "your-password" | shasum -a 256
```

## IP allowlist

The allowlist restricts both the UI and the mock API to the IPs or CIDR ranges you list; callers outside it get a 403. Use it when the simulation should only answer from an office network or a CI runner's range.

> The IP allowlist is part of plans that include it; on other plans the section shows as locked.

## Environment variables

Name and value pairs, handed to the runtime as plain environment on the next deploy. They are stored as entered, with no encryption: a simulation serves test traffic, so its variables are configuration, not secrets. Put mock-grade values in them, an upstream sandbox token or a feature flag, and keep production secrets out.

A backend sandbox takes no variables; its runtime is configured by the product, and the page shows only Access.
