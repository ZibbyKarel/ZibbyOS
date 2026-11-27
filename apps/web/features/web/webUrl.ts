/**
 * What the operator typed in the browser address field as an http(s) URL, or null.
 * A bare domain (`example.com`, `localhost:3000/x`) gets `https://`; other schemes
 * (`javascript:`, `file:`, `mailto:` …) and anything with whitespace are rejected — no search.
 */
export function normalizeWebUrl(input: string): string | null {
  const v = input.trim();
  if (!v || /\s/.test(v)) return null;
  const hostPort = /^[^/?#]*:\d+(?:[/?#]|$)/.test(v);
  if (!v.includes("://") && /^[a-z][a-z0-9+.-]*:/i.test(v) && !hostPort) return null;
  try {
    const u = new URL(v.includes("://") ? v : `https://${v}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const named =
      u.hostname.includes(".") || u.hostname === "localhost" || u.hostname.includes(":");
    return named ? u.href : null;
  } catch {
    return null;
  }
}
