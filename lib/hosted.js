// Hosted tool definitions, packed at build time, so they are listed before the user logs in.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const HOSTED_TOOLS_FILE =
  process.env.MOCKZILLA_HOSTED_TOOLS_FILE || fileURLToPath(new URL("../hosted-tools.json", import.meta.url));

let loading = null;

// Empty when the file is missing, as in a checkout nobody built: hosted tools then appear only after login.
export function hostedToolsSnapshot() {
  loading ??= readFile(HOSTED_TOOLS_FILE, "utf8")
    .then((text) => JSON.parse(text).tools ?? [])
    .catch(() => []);
  return loading;
}
