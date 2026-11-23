import { randomInt } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import {
  CANVAS_ID_PATTERN,
  type CanvasManifest,
  CanvasManifestSchema,
  type CanvasMeta,
  CanvasMetaSchema,
  type CanvasParamValues,
  type CanvasVersion,
} from "@zibby/contracts";

export const CANVAS_DIR = Symbol("CANVAS_DIR");
export const CANVAS_MAX_HTML_BYTES = 2 * 1024 * 1024;

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export type CanvasStoreErrorCode =
  | "empty"
  | "too-large"
  | "not-found"
  | "bad-manifest"
  | "bad-params"
  | "not-allowed";

/** A rejected publish — the chat tool turns `message` into the model-visible error. */
export class CanvasStoreError extends Error {
  constructor(
    readonly code: CanvasStoreErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface PublishCanvasInput {
  title: string;
  html: string;
  conversationId?: string;
  /** Existing canvas id → publish its next version; omitted → a new canvas. */
  id?: string;
  note?: string;
}

const MANIFEST_RE =
  /<script\b[^>]*\btype\s*=\s*["']application\/zibby\+json["'][^>]*>([\s\S]*?)<\/script>/i;

/** The page's manifest (first `application/zibby+json` block), `undefined` when absent; invalid → `bad-manifest`. */
export function parseManifest(html: string): CanvasManifest | undefined {
  const raw = MANIFEST_RE.exec(html)?.[1];
  if (raw === undefined) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new CanvasStoreError(
      "bad-manifest",
      `manifest is not valid JSON: ${(e as Error).message}`,
    );
  }
  const parsed = CanvasManifestSchema.safeParse(json);
  if (!parsed.success)
    throw new CanvasStoreError(
      "bad-manifest",
      parsed.error.issues.map((i) => `${i.path.join(".") || "manifest"}: ${i.message}`).join("; "),
    );
  return parsed.data;
}

/** The code version `version` uses: itself when `code`, else its `base`. */
export function codeVersionOf(meta: CanvasMeta, version: number): CanvasVersion | null {
  const v = meta.versions.find((x) => x.version === version);
  if (!v) return null;
  if (v.kind === "code") return v;
  return meta.versions.find((x) => x.version === v.base && x.kind === "code") ?? null;
}

const defaultsOf = (m?: CanvasManifest): CanvasParamValues =>
  Object.fromEntries((m?.params ?? []).map((p) => [p.id, p.value]));

function validateParams(manifest: CanvasManifest | undefined, values: CanvasParamValues): void {
  const bad = (msg: string) => new CanvasStoreError("bad-params", msg);
  const declared = new Map((manifest?.params ?? []).map((p) => [p.id, p]));
  for (const [id, v] of Object.entries(values)) {
    const p = declared.get(id);
    if (!p) throw bad(`"${id}" is not a declared param`);
    if (p.type === "number") {
      if (typeof v !== "number" || !Number.isFinite(v)) throw bad(`"${id}" must be a number`);
      if (p.min !== undefined && v < p.min) throw bad(`"${id}" must be >= ${p.min}`);
      if (p.max !== undefined && v > p.max) throw bad(`"${id}" must be <= ${p.max}`);
    } else if (p.type === "boolean") {
      if (typeof v !== "boolean") throw bad(`"${id}" must be a boolean`);
    } else if (typeof v !== "string") {
      throw bad(`"${id}" must be a string`);
    } else if (p.type === "select" && !(p.options ?? []).includes(v)) {
      throw bad(`"${id}" must be one of: ${(p.options ?? []).join(", ")}`);
    }
  }
}

/** Atomic write: tmp file next to the target, then rename. */
async function writeAtomic(file: string, data: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${randomInt(1e9)}.tmp`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, file);
}

/**
 * File-backed canvas registry: `<id>/meta.json` + `<id>/v<n>/index.html`. A version is
 * a new folder and never changes afterwards; `meta.json` is the only mutable file.
 */
@Injectable()
export class CanvasStore {
  // ponytail: one global publish queue (read-modify-write of meta.json); per-id if it ever matters.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(@Inject(CANVAS_DIR) private readonly dir: string) {}

  publish(input: PublishCanvasInput): Promise<CanvasMeta> {
    return this.enqueue(() => this.doPublish(input));
  }

  setParams(
    id: string,
    values: CanvasParamValues,
    opts: { note?: string; by: "agent" | "operator" },
  ): Promise<CanvasMeta> {
    return this.enqueue(() => this.doSetParams(id, values, opts));
  }

  restore(id: string, version: number): Promise<CanvasMeta> {
    return this.enqueue(() => this.doRestore(id, version));
  }

  /** What a version renders: html + params + the code version it comes from. */
  async effective(
    id: string,
    version: number,
  ): Promise<{ html: string; params: CanvasParamValues; codeVersion: number } | null> {
    const meta = await this.get(id);
    const v = meta?.versions.find((x) => x.version === version);
    if (!meta || !v) return null;
    const code = codeVersionOf(meta, version);
    if (!code) return null;
    const html = await this.readHtml(id, code.version);
    if (html === null) return null;
    const params = v.kind === "params" ? (v.params ?? {}) : defaultsOf(v.manifest);
    return { html, params, codeVersion: code.version };
  }

  async grants(id: string): Promise<string[]> {
    if (!CANVAS_ID_PATTERN.test(id)) return [];
    try {
      const raw: unknown = JSON.parse(
        await fs.readFile(path.join(this.dir, id, "grants.json"), "utf8"),
      );
      return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  /** Grant a manifest-declared origin (of the CURRENT code version) to the canvas. */
  grant(id: string, origin: string): Promise<string[]> {
    return this.enqueue(async () => {
      const meta = await this.get(id);
      if (!meta) throw new CanvasStoreError("not-found", `Canvas "${id}" not found`);
      let norm: string;
      try {
        norm = new URL(origin).origin;
      } catch {
        throw new CanvasStoreError("not-allowed", `"${origin}" is not a valid origin`);
      }
      const net = codeVersionOf(meta, meta.current)?.manifest?.net ?? [];
      if (!net.includes(norm))
        throw new CanvasStoreError("not-allowed", `${norm} is not in the manifest net list`);
      const next = [...new Set([...(await this.grants(id)), norm])];
      await writeAtomic(path.join(this.dir, id, "grants.json"), JSON.stringify(next, null, 2));
      return next;
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async doSetParams(
    id: string,
    values: CanvasParamValues,
    opts: { note?: string; by: "agent" | "operator" },
  ): Promise<CanvasMeta> {
    const meta = await this.get(id);
    if (!meta) throw new CanvasStoreError("not-found", `Canvas "${id}" not found`);
    const cur = meta.versions.find((v) => v.version === meta.current);
    const base = codeVersionOf(meta, meta.current);
    if (!cur || !base) throw new CanvasStoreError("not-found", "current version is missing");
    validateParams(base.manifest, values);
    const params = {
      ...(cur.kind === "params" ? cur.params : defaultsOf(base.manifest)),
      ...values,
    };
    const at = new Date().toISOString();
    const last = meta.versions[meta.versions.length - 1];
    let versions: CanvasVersion[];
    let current = meta.current;
    if (
      last &&
      opts.by === "operator" &&
      last.kind === "params" &&
      last.by === "operator" &&
      last.base === base.version &&
      last.version === meta.current
    ) {
      versions = meta.versions.map((v) =>
        v === last ? { ...v, params, at, ...(opts.note ? { note: opts.note } : {}) } : v,
      );
    } else {
      current = Math.max(...meta.versions.map((v) => v.version)) + 1;
      versions = [
        ...meta.versions,
        {
          version: current,
          at,
          kind: "params",
          base: base.version,
          params,
          by: opts.by,
          ...(opts.note ? { note: opts.note } : {}),
        },
      ];
    }
    return this.saveMeta({ ...meta, versions, current });
  }

  private async doRestore(id: string, version: number): Promise<CanvasMeta> {
    const meta = await this.get(id);
    const src = meta?.versions.find((v) => v.version === version);
    if (!meta || !src) throw new CanvasStoreError("not-found", `Version ${version} not found`);
    const next = Math.max(...meta.versions.map((v) => v.version)) + 1;
    const copy: CanvasVersion = {
      ...src,
      version: next,
      at: new Date().toISOString(),
      by: "operator",
      note: `Restored v${version}`,
    };
    if (src.kind === "code") {
      const html = await this.readHtml(id, version);
      if (html === null) throw new CanvasStoreError("not-found", `Version ${version} has no html`);
      const dir = path.join(this.dir, id, `v${next}`);
      await fs.mkdir(dir, { recursive: true });
      await writeAtomic(path.join(dir, "index.html"), html);
    }
    return this.saveMeta({ ...meta, versions: [...meta.versions, copy], current: next });
  }

  private async saveMeta(meta: CanvasMeta): Promise<CanvasMeta> {
    await writeAtomic(path.join(this.dir, meta.id, "meta.json"), JSON.stringify(meta, null, 2));
    return meta;
  }

  async get(id: string): Promise<CanvasMeta | null> {
    if (!CANVAS_ID_PATTERN.test(id)) return null;
    try {
      const raw = JSON.parse(await fs.readFile(path.join(this.dir, id, "meta.json"), "utf8"));
      const parsed = CanvasMetaSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  /** The html of one version, or `null` for a malformed id/version or a missing file. */
  async readHtml(id: string, version: number): Promise<string | null> {
    if (!CANVAS_ID_PATTERN.test(id) || !Number.isInteger(version) || version < 1) return null;
    try {
      return await fs.readFile(path.join(this.dir, id, `v${version}`, "index.html"), "utf8");
    } catch {
      return null;
    }
  }

  private async doPublish(input: PublishCanvasInput): Promise<CanvasMeta> {
    if (input.html.trim() === "") throw new CanvasStoreError("empty", "html is empty");
    if (Buffer.byteLength(input.html, "utf8") > CANVAS_MAX_HTML_BYTES)
      throw new CanvasStoreError("too-large", "html exceeds 2 MB");

    const manifest = parseManifest(input.html);
    const existing = input.id ? await this.get(input.id) : null;
    if (input.id && !existing)
      throw new CanvasStoreError("not-found", `Canvas "${input.id}" not found`);

    const id = existing?.id ?? (await this.newId());
    const version = existing ? Math.max(...existing.versions.map((v) => v.version)) + 1 : 1;
    const versionDir = path.join(this.dir, id, `v${version}`);
    await fs.mkdir(versionDir, { recursive: true });
    await writeAtomic(path.join(versionDir, "index.html"), input.html);

    const meta: CanvasMeta = {
      id,
      title: input.title.trim() || existing?.title || "Canvas",
      ...((input.conversationId ?? existing?.conversationId)
        ? { conversationId: (input.conversationId ?? existing?.conversationId) as string }
        : {}),
      versions: [
        ...(existing?.versions ?? []),
        {
          version,
          at: new Date().toISOString(),
          kind: "code" as const,
          by: "agent" as const,
          ...(manifest ? { manifest } : {}),
          ...(input.note ? { note: input.note } : {}),
        },
      ],
      current: version,
    };
    await writeAtomic(path.join(this.dir, id, "meta.json"), JSON.stringify(meta, null, 2));
    return meta;
  }

  private async newId(): Promise<string> {
    for (;;) {
      let id = "";
      for (let i = 0; i < 10; i++) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
      try {
        await fs.access(path.join(this.dir, id));
      } catch {
        return id;
      }
    }
  }
}
