// Tiny helpers shared across modules.

// Compare dotted numeric versions. A non-numeric or missing version
// counts as new enough: a `go run` invocation reports the pinned
// version, and guessing "too old" would block a working CLI.
export function versionAtLeast(have, want) {
  const parse = (v) => String(v || "").split(".").map((n) => parseInt(n, 10));
  const h = parse(have);
  const w = parse(want);
  if (h.some(Number.isNaN) || h.length === 0) return true;
  for (let i = 0; i < w.length; i++) {
    const a = h[i] ?? 0;
    if (a !== w[i]) return a > w[i];
  }
  return true;
}

// A failing `mockzilla info` can print hundreds of KB of model-build
// detail. The first lines carry the cause; the rest only costs the
// agent its context window.
export function briefError(text, max = 400) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… (${s.length - max} more characters)`;
}

export function shellEscape(s) {
  if (process.platform === "win32") {
    // Conservative quote: wrap and double internal quotes.
    return `"${String(s).replace(/"/g, '""')}"`;
  }
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}
