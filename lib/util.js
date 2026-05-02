// Tiny helpers shared across modules.

export function shellEscape(s) {
  if (process.platform === "win32") {
    // Conservative quote: wrap and double internal quotes.
    return `"${String(s).replace(/"/g, '""')}"`;
  }
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}
