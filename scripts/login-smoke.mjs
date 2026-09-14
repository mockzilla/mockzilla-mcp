// Login round-trip against a fake OAuth + MCP server: discovery, the browser
// redirect, token exchange, packed hosted tools listed before login, refresh
// after a 401, logout, and MOCKZILLA_TOKEN. Run via `node scripts/login-smoke.mjs`.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

const CLIENT_ID = "https://example.test/mcp-client.json";

const fake = await startFakeServer();
const configHome = await mkdtemp(path.join(tmpdir(), "mockzilla-mcp-login-"));
const hostedToolsFile = path.join(configHome, "hosted-tools.json");
await writeFile(
  hostedToolsFile,
  JSON.stringify({ tools: [{ name: "get_context", description: "packed", inputSchema: { type: "object" } }] }),
);

try {
  await loginFlow();
  await staticToken();
  console.log("login-smoke: ok");
} finally {
  fake.server.close();
}

async function loginFlow() {
  const bridge = startBridge({});

  const init = await bridge.call("initialize", { protocolVersion: "2025-06-18" });
  check(init.result.capabilities.tools.listChanged === true, "listChanged capability");

  let names = await toolNames(bridge);
  check(names.includes("login") && names.includes("get_context"), "packed hosted tools listed before login");

  const blocked = await bridge.call("tools/call", { name: "get_context", arguments: {} });
  check(blocked.result.isError && /login/.test(blocked.result.content[0].text), "hosted call asks for login");

  const started = parse(await bridge.call("tools/call", { name: "login", arguments: {} }));
  check(started.status === "waiting_for_browser" && started.url.startsWith(fake.base), "login returns the url");

  const authorize = await fetch(started.url, { redirect: "manual" });
  const callback = authorize.headers.get("location");
  check(callback.startsWith("http://127.0.0.1:"), "authorize redirects to the loopback callback");
  const changed = bridge.nextNotification();
  const landing = await fetch(callback);
  check(landing.ok && /logged in/.test(await landing.text()), "callback page confirms the login");
  check((await changed).method === "notifications/tools/list_changed", "tool list change is announced");

  const creds = path.join(configHome, "mockzilla-mcp", "credentials.json");
  check(((await stat(creds)).mode & 0o777) === 0o600, "credentials are private to the user");
  check(JSON.parse(await readFile(creds, "utf8"))[`${fake.base}/mcp`], "credentials are keyed by server url");

  names = await toolNames(bridge);
  check(names.includes("get_context"), "hosted tools appear after login");
  check(parse(await bridge.call("tools/call", { name: "get_context", arguments: {} })).org_id === "org-1", "hosted call works");

  fake.state.access = "revoked-access";
  check(parse(await bridge.call("tools/call", { name: "get_context", arguments: {} })).org_id === "org-1", "401 triggers a refresh and a retry");
  check(fake.state.refreshes === 1, "exactly one refresh");

  const again = parse(await bridge.call("tools/call", { name: "login", arguments: {} }));
  check(again.logged_in === true, "login reports an existing login");

  const gone = bridge.nextNotification();
  const out = parse(await bridge.call("tools/call", { name: "logout", arguments: {} }));
  check(out.logged_out && out.was_logged_in, "logout succeeds");
  check((await gone).method === "notifications/tools/list_changed", "logout announces the change");
  check(fake.state.revoked.length === 1, "logout revokes the connection");
  names = await toolNames(bridge);
  check(names.includes("get_context"), "packed hosted tools still listed after logout");
  const afterLogout = await bridge.call("tools/call", { name: "get_context", arguments: {} });
  check(afterLogout.result.isError && /login/.test(afterLogout.result.content[0].text), "hosted call asks for login again");

  bridge.stop();
}

async function staticToken() {
  const bridge = startBridge({ MOCKZILLA_TOKEN: "static-key" });
  await bridge.call("initialize", { protocolVersion: "2025-06-18" });
  check((await toolNames(bridge)).includes("get_context"), "MOCKZILLA_TOKEN shows hosted tools without login");
  const status = parse(await bridge.call("tools/call", { name: "login", arguments: {} }));
  check(status.logged_in && status.via === "MOCKZILLA_TOKEN", "login defers to MOCKZILLA_TOKEN");
  bridge.stop();
}

function startBridge(env) {
  const child = spawn(process.execPath, ["bin/cli.js"], {
    stdio: ["pipe", "pipe", "inherit"],
    env: {
      ...process.env,
      MOCKZILLA_TOKEN: "",
      MOCKZILLA_MCP_URL: `${fake.base}/mcp`,
      MOCKZILLA_MCP_CLIENT_ID: CLIENT_ID,
      MOCKZILLA_HOSTED_TOOLS_FILE: hostedToolsFile,
      MOCKZILLA_NO_BROWSER: "1",
      XDG_CONFIG_HOME: configHome,
      ...env,
    },
  });
  const waiting = new Map();
  const notifications = [];
  let notified = null;
  let buffer = "";
  let nextId = 1;
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const message = JSON.parse(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
      if (message.id !== undefined) {
        waiting.get(message.id)?.(message);
      } else if (notified) {
        notified(message);
        notified = null;
      } else {
        notifications.push(message);
      }
    }
  });
  return {
    call(method, params) {
      const id = nextId++;
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      return withTimeout(new Promise((resolve) => waiting.set(id, resolve)), `${method} reply`);
    },
    nextNotification() {
      if (notifications.length) return Promise.resolve(notifications.shift());
      return withTimeout(new Promise((resolve) => (notified = resolve)), "notification");
    },
    stop() {
      child.kill();
    },
  };
}

async function toolNames(bridge) {
  return (await bridge.call("tools/list", {})).result.tools.map((t) => t.name);
}

function parse(response) {
  if (response.error) throw new Error(response.error.message);
  if (response.result?.isError) throw new Error(response.result.content[0].text);
  return JSON.parse(response.result.content[0].text);
}

function check(ok, what) {
  if (!ok) {
    console.error(`login-smoke: FAILED: ${what}`);
    process.exit(1);
  }
}

function withTimeout(promise, what) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out waiting for ${what}`)), 5000)),
  ]);
}

async function startFakeServer() {
  const state = { access: "", refresh: "", challenge: "", refreshes: 0, revoked: [], counter: 0 };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, base);
    const body = await new Promise((resolve) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => resolve(data));
    });
    const json = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    const form = new URLSearchParams(body);
    const issue = () => {
      state.counter += 1;
      state.access = `access-${state.counter}`;
      state.refresh = `refresh-${state.counter}`;
      return json(200, { access_token: state.access, refresh_token: state.refresh, expires_in: 3600, scope: "mcp:read mcp:write", token_type: "Bearer" });
    };

    if (url.pathname === "/.well-known/oauth-protected-resource/mcp") {
      return json(200, { resource: `${base}/mcp`, authorization_servers: [base] });
    }
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return json(200, {
        issuer: base,
        authorization_endpoint: `${base}/authorize`,
        token_endpoint: `${base}/token`,
        revocation_endpoint: `${base}/revoke`,
      });
    }
    if (url.pathname === "/authorize") {
      const p = url.searchParams;
      const ok =
        p.get("client_id") === CLIENT_ID &&
        p.get("code_challenge_method") === "S256" &&
        p.get("resource") === `${base}/mcp` &&
        p.get("scope") === "mcp:read mcp:write";
      if (!ok) return json(400, { error: "invalid_request" });
      state.challenge = p.get("code_challenge");
      const back = new URL(p.get("redirect_uri"));
      back.search = new URLSearchParams({ code: "the-code", state: p.get("state"), iss: base }).toString();
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }
    if (url.pathname === "/token" && form.get("grant_type") === "authorization_code") {
      const verified =
        createHash("sha256").update(form.get("code_verifier")).digest("base64url") === state.challenge;
      if (form.get("code") !== "the-code" || !verified) return json(400, { error: "invalid_grant" });
      return issue();
    }
    if (url.pathname === "/token" && form.get("grant_type") === "refresh_token") {
      if (form.get("refresh_token") !== state.refresh) return json(400, { error: "invalid_grant" });
      state.refreshes += 1;
      return issue();
    }
    if (url.pathname === "/revoke") {
      state.revoked.push(form.get("token"));
      return json(200, {});
    }
    if (url.pathname === "/mcp") {
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${state.access}` && auth !== "Bearer static-key") {
        res.writeHead(401).end();
        return;
      }
      const rpc = JSON.parse(body);
      if (rpc.method === "tools/list") {
        return json(200, { jsonrpc: "2.0", id: rpc.id, result: { tools: [{ name: "get_context", description: "", inputSchema: { type: "object" } }] } });
      }
      return json(200, {
        jsonrpc: "2.0",
        id: rpc.id,
        result: { content: [{ type: "text", text: JSON.stringify({ org_id: "org-1" }) }], isError: false },
      });
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base, state };
}
