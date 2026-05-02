// Hosted-plane forwarding. The bridge POSTs JSON-RPC payloads upstream
// (default: https://app.mockzilla.org/mcp/) with the user's bearer token
// when MOCKZILLA_TOKEN is set.

const ENDPOINT =
  process.env.MOCKZILLA_MCP_URL || "https://app.mockzilla.org/mcp/";
const TOKEN = process.env.MOCKZILLA_TOKEN;

export const hasToken = Boolean(TOKEN);

export async function proxy(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }

  return res.json();
}
