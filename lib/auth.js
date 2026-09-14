// Hosted-plane login. The bridge is its own OAuth client: `login` opens the
// Mockzilla consent page in the browser, catches the callback on 127.0.0.1,
// and keeps the tokens on this machine, one login per server URL.
// MOCKZILLA_TOKEN, when set, is used as-is instead.

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import { homedir } from "node:os";
import path from "node:path";

export const SERVER_URL = (
  process.env.MOCKZILLA_MCP_URL || "https://platform.mockzilla.org/mcp"
).replace(/\/+$/, "");

const CLIENT_ID =
  process.env.MOCKZILLA_MCP_CLIENT_ID || "https://mockzilla.org/mcp-client.json";
const STATIC_TOKEN = process.env.MOCKZILLA_TOKEN || "";
const OPEN_BROWSER = process.env.MOCKZILLA_NO_BROWSER !== "1";
const SCOPE = "mcp:read mcp:write";
const LOGIN_TIMEOUT_MS = 5 * 60_000;
const REFRESH_MARGIN_MS = 60_000;
const HTTP_TIMEOUT_MS = 15_000;
const LOCK_WAIT_MS = 10_000;
const LOCK_STALE_MS = 30_000;

const CONFIG_DIR = path.join(
  process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"),
  "mockzilla-mcp",
);
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json");
const LOCK_PATH = path.join(CONFIG_DIR, "credentials.lock");

const listeners = new Set();
let pendingLogin = null;
let lastLoginError = null;

export function usesStaticToken() {
  return STATIC_TOKEN !== "";
}

export function onAuthChange(listener) {
  listeners.add(listener);
}

export async function isAuthenticated() {
  return STATIC_TOKEN !== "" || (await readCredentials()) !== null;
}

export async function accessToken() {
  if (STATIC_TOKEN) return STATIC_TOKEN;
  const creds = await readCredentials();
  if (!creds) return null;
  if (Date.now() < creds.expires_at - REFRESH_MARGIN_MS) return creds.access_token;
  return await refresh(creds.access_token);
}

// The hosted endpoint answered 401 to `rejected`. Returns a token worth one
// retry, or null once the saved login is gone.
export async function renewAfterRejection(rejected) {
  if (STATIC_TOKEN) return null;
  return await refresh(rejected);
}

export async function forget() {
  if (STATIC_TOKEN) return;
  await clearCredentials();
}

export async function login() {
  if (STATIC_TOKEN) {
    return { logged_in: true, via: "MOCKZILLA_TOKEN", server: SERVER_URL };
  }
  if (await readCredentials()) {
    return { logged_in: true, server: SERVER_URL };
  }
  if (!pendingLogin) {
    const failed = lastLoginError;
    lastLoginError = null;
    pendingLogin = await beginLogin();
    if (failed) pendingLogin.previousError = failed;
  }
  return {
    logged_in: false,
    status: "waiting_for_browser",
    url: pendingLogin.url,
    previous_attempt_error: pendingLogin.previousError ?? undefined,
    notes:
      (OPEN_BROWSER
        ? "A browser window opened on the Mockzilla login. If it did not, "
        : "Give the user this link to ") +
      "open `url`, log in, pick an organization and approve. Once they " +
      "approve, call the hosted tool again. Call login again to check.",
  };
}

export async function logout() {
  if (STATIC_TOKEN) {
    return {
      logged_out: false,
      reason: "MOCKZILLA_TOKEN is set. Remove it from the MCP client config to log out.",
    };
  }
  const creds = await readCredentials();
  if (!creds) return { logged_out: true, was_logged_in: false };
  if (creds.revocation_endpoint) {
    await postForm(creds.revocation_endpoint, {
      token: creds.refresh_token,
      client_id: creds.client_id,
    }).catch(() => {});
  }
  await clearCredentials();
  return { logged_out: true, was_logged_in: true, server: SERVER_URL };
}

async function beginLogin() {
  const meta = await discover();
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;

  const url = new URL(meta.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: SCOPE,
    resource: SERVER_URL,
  }).toString();

  const attempt = { url: url.toString() };
  const timer = setTimeout(() => finish(new Error("Login timed out.")), LOGIN_TIMEOUT_MS);

  function finish(err) {
    clearTimeout(timer);
    server.close();
    if (err) lastLoginError = err.message;
    if (pendingLogin === attempt) pendingLogin = null;
  }

  server.on("request", async (req, res) => {
    const params = new URL(req.url, redirectUri).searchParams;
    if (!req.url.startsWith("/callback")) {
      res.writeHead(404).end();
      return;
    }
    if (params.get("state") !== state) {
      page(res, 400, "This login link is out of date. Ask your agent to log in again.");
      return;
    }
    if (params.get("error")) {
      page(res, 200, "Login cancelled. You can close this tab.");
      finish(new Error(params.get("error_description") || params.get("error")));
      return;
    }
    const iss = params.get("iss");
    if (iss && iss !== meta.issuer) {
      page(res, 400, "The login came back from an unexpected server.");
      finish(new Error(`Unexpected issuer ${iss}.`));
      return;
    }
    try {
      await exchangeCode(meta, params.get("code") ?? "", verifier, redirectUri);
      page(res, 200, "You're logged in to Mockzilla. You can close this tab.");
      finish(null);
      notify();
    } catch (err) {
      page(res, 500, "Login failed. Ask your agent to try again.");
      finish(err);
    }
  });

  openBrowser(attempt.url);
  return attempt;
}

async function discover() {
  const server = new URL(SERVER_URL);
  const suffix = server.pathname === "/" ? "" : server.pathname;
  const resource = await getJson(`${server.origin}/.well-known/oauth-protected-resource${suffix}`);
  const issuer = resource.authorization_servers?.[0];
  if (!issuer) throw new Error(`${SERVER_URL} does not name an authorization server.`);
  const meta = await getJson(`${issuer.replace(/\/+$/, "")}/.well-known/oauth-authorization-server`);
  if (meta.issuer !== issuer) {
    throw new Error(`Authorization server metadata names ${meta.issuer}, expected ${issuer}.`);
  }
  return meta;
}

async function exchangeCode(meta, code, verifier, redirectUri) {
  const res = await postForm(meta.token_endpoint, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    code_verifier: verifier,
    resource: SERVER_URL,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error_description || body.error || `Token request failed (${res.status}).`);
  }
  await withLock(() =>
    saveCredentials({
      client_id: CLIENT_ID,
      issuer: meta.issuer,
      token_endpoint: meta.token_endpoint,
      revocation_endpoint: meta.revocation_endpoint ?? null,
      ...tokenFields(body),
    }),
  );
}

// Refresh tokens rotate, and the server revokes the whole connection when one
// is used twice. Every bridge process on this machine shares the file, so the
// refresh happens under a lock and re-reads first: another process may already
// have swapped the token this one was holding.
async function refresh(stale) {
  const outcome = await withLock(async () => {
    const creds = await readCredentials();
    if (!creds) return { token: null };
    if (creds.access_token !== stale && Date.now() < creds.expires_at - REFRESH_MARGIN_MS) {
      return { token: creds.access_token };
    }
    const res = await postForm(creds.token_endpoint, {
      grant_type: "refresh_token",
      refresh_token: creds.refresh_token,
      client_id: creds.client_id,
      resource: SERVER_URL,
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      await saveCredentials({ ...creds, ...tokenFields(body) });
      return { token: body.access_token };
    }
    if (body.error === "invalid_grant") {
      await removeCredentials();
      return { token: null, loggedOut: true };
    }
    throw new Error(body.error_description || `Token refresh failed (${res.status}).`);
  });
  if (outcome.loggedOut) notify();
  return outcome.token;
}

function tokenFields(body) {
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + (Number(body.expires_in) || 3600) * 1000,
    scope: body.scope ?? "",
  };
}

async function readCredentials() {
  try {
    const all = JSON.parse(await readFile(CREDENTIALS_PATH, "utf8"));
    const creds = all[SERVER_URL];
    return creds && creds.access_token && creds.refresh_token ? creds : null;
  } catch {
    return null;
  }
}

async function saveCredentials(creds) {
  const all = await readAll();
  all[SERVER_URL] = creds;
  await writeAll(all);
}

async function removeCredentials() {
  const all = await readAll();
  if (!(SERVER_URL in all)) return;
  delete all[SERVER_URL];
  await writeAll(all);
}

async function clearCredentials() {
  await withLock(removeCredentials);
  notify();
}

async function readAll() {
  try {
    return JSON.parse(await readFile(CREDENTIALS_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function writeAll(all) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const tmp = `${CREDENTIALS_PATH}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(all, null, 2), { mode: 0o600 });
  await rename(tmp, CREDENTIALS_PATH);
}

async function withLock(fn) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      await mkdir(LOCK_PATH);
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      const age = await stat(LOCK_PATH).then((s) => Date.now() - s.mtimeMs, () => 0);
      if (age > LOCK_STALE_MS) {
        await rm(LOCK_PATH, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) throw new Error("Timed out waiting for the credentials lock.");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  try {
    return await fn();
  } finally {
    await rm(LOCK_PATH, { recursive: true, force: true });
  }
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GET ${url} returned ${res.status}.`);
  return await res.json();
}

function postForm(url, fields) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
}

function notify() {
  for (const listener of listeners) listener();
}

function openBrowser(url) {
  if (!OPEN_BROWSER) return;
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // No browser opener here; the agent shows the URL instead.
  }
}

function page(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><meta charset="utf-8"><title>Mockzilla</title>` +
      `<body style="font-family:system-ui;margin:4rem auto;max-width:32rem;text-align:center">` +
      `<p>${message}</p></body>`,
  );
}

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
