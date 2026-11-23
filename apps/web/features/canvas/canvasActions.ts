/** Segments of the dashboard a canvas may link to with `zibby://<segment>/…`. */
export const ZIBBY_SEGMENTS = [
  "agents",
  "automations",
  "commands",
  "gates",
  "hooks",
  "mcp",
  "memory",
  "overview",
  "workflows",
  "projects",
  "runs",
  "settings",
  "skills",
] as const;

/** `zibby://<segment>/<rest>` → in-app path, or `null` for anything else. */
export function zibbyHrefToPath(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const m = /^zibby:\/\/([a-z]+)([/?#][^\s\\]*)?$/.exec(href);
  const segment = m?.[1];
  if (!m || !segment || !(ZIBBY_SEGMENTS as readonly string[]).includes(segment)) return null;

  if (/[\u0000-\u001f]/.test(m[2] ?? "")) return null;
  return `/${segment}${m[2] ?? ""}`;
}

/** A safe download file name: no path separators / control chars, ≤ 120 chars, never empty. */
export function sanitizeFilename(raw: unknown): string {
  const clean = String(raw ?? "")
    .replace(/[/\\\u0000-\u001f\u007f]/g, "")
    .replace(/^\.+/, "")
    .trim();
  return clean.slice(0, 120) || "download";
}

export const MAX_ERROR_LOG_CHARS = 4000;

/** The page's error log as one quoted block, capped. */
export function formatErrorLog(errors: readonly { message: string; stack?: string }[]): string {
  const log = errors
    .map((e) => (e.stack ? `${e.message}\n${e.stack}` : e.message))
    .join("\n\n")
    .slice(0, MAX_ERROR_LOG_CHARS);
  return "```\n" + log.replaceAll("```", "'''") + "\n```";
}

/** Save `data` as a file via a temporary anchor in the top document. */
export function saveDownload(input: {
  filename: string;
  mime: string;
  data: string;
  encoding: "utf8" | "base64";
}): void {
  const part: BlobPart =
    input.encoding === "base64"
      ? Uint8Array.from(atob(input.data), (c) => c.charCodeAt(0))
      : input.data;
  const url = URL.createObjectURL(new Blob([part], { type: input.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeFilename(input.filename);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
