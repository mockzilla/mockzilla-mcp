// Hosted-plane forwarding. The bridge POSTs JSON-RPC payloads to the hosted
// MCP endpoint with the saved login's access token, or MOCKZILLA_TOKEN.

import { accessToken, forget, renewAfterRejection, SERVER_URL, usesStaticToken } from "./auth.js";

export async function proxy(payload) {
  const token = await accessToken();
  if (!token) {
    throw new Error("Not logged in to Mockzilla. Call the login tool first.");
  }

  let res = await post(payload, token);
  if (res.status === 401) {
    const renewed = await renewAfterRejection(token);
    if (renewed) res = await post(payload, renewed);
    if (res.status === 401) {
      if (usesStaticToken()) {
        throw new Error("Mockzilla rejected MOCKZILLA_TOKEN.");
      }
      await forget();
      throw new Error("Mockzilla rejected the login. Call the login tool to log in again.");
    }
  }

  // Notifications get no body: 202 is what Streamable HTTP asks for, 204 what older servers sent.
  if (res.status === 202 || res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

function post(payload, token) {
  return fetch(SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}
