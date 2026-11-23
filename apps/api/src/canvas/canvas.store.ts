import { randomInt } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { CANVAS_ID_PATTERN, type CanvasMeta, CanvasMetaSchema } from "@zibby/contracts";

export const CANVAS_DIR = Symbol("CANVAS_DIR");
export const CANVAS_MAX_HTML_BYTES = 2 * 1024 * 1024;

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export type CanvasStoreErrorCode = "empty" | "too-large" | "not-found";

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
    const run = this.queue.then(() => this.doPublish(input));
    this.queue = run.catch(() => undefined);
    return run;
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
