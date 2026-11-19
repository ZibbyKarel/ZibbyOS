import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { type NotePins, NotePinsSchema } from "@zibby/contracts";
import { VAULT_DIR } from "../memory/vault.service";
import { ensureDir, safeJson, writeFileAtomic } from "../shared/file-storage";

export const NOTE_PINS_FILE = "NOTE_PINS_FILE";

/** The path is not a safe vault-relative `.md` path (→ 422). */
export class InvalidNotePathError extends Error {}
/** The path is safe but no such note exists (→ 404). */
export class NotePathNotFoundError extends Error {}

const MAX_NOTES = 5000;

/**
 * Path-based access to the vault's markdown notes plus the pinned set (`note-pins.json`).
 * Every path is vault-relative and must be a visible `.md` file under the vault root — `..`,
 * absolute paths, dot-folders and symlinks leaving the root are refused.
 */
@Injectable()
export class NotesService {
  private readonly root: string;

  constructor(
    @Inject(VAULT_DIR) vaultDir: string,
    @Inject(NOTE_PINS_FILE) private readonly pinsFile: string,
  ) {
    this.root = path.resolve(vaultDir);
  }

  async tree(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
        if (e.name.startsWith(".") || out.length >= MAX_NOTES) continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) await walk(abs);
        else if (e.isFile() && e.name.endsWith(".md"))
          out.push(path.relative(this.root, abs).split(path.sep).join("/"));
      }
    };
    await walk(this.root);
    return out.sort();
  }

  async read(rel: string): Promise<string> {
    const file = await this.resolve(rel);
    return fs.readFile(file, "utf8").catch(() => {
      throw new NotePathNotFoundError(rel);
    });
  }

  /** Overwrites an existing note only — creating notes is not part of this surface. */
  async write(rel: string, body: string): Promise<string> {
    const file = await this.resolve(rel);
    await fs.access(file).catch(() => {
      throw new NotePathNotFoundError(rel);
    });
    await writeFileAtomic(file, body);
    return body;
  }

  async pins(): Promise<NotePins> {
    const raw = await fs.readFile(this.pinsFile, "utf8").catch(() => null);
    const parsed = NotePinsSchema.safeParse(raw === null ? null : safeJson(raw));
    return parsed.success ? parsed.data : { paths: [] };
  }

  async setPins(next: NotePins): Promise<NotePins> {
    const out = { paths: [...new Set(NotePinsSchema.parse(next).paths)] };
    await ensureDir(path.dirname(this.pinsFile));
    await writeFileAtomic(this.pinsFile, `${JSON.stringify(out, null, 2)}\n`);
    return out;
  }

  /** Vault-relative path → absolute file, or throws {@link InvalidNotePathError}. */
  private async resolve(rel: string): Promise<string> {
    const parts = rel.split("/");
    if (
      !rel.endsWith(".md") ||
      rel.includes("\\") ||
      rel.includes("\0") ||
      parts.some((p) => p === "" || p === "." || p === ".." || p.startsWith("."))
    )
      throw new InvalidNotePathError(`Invalid note path "${rel}"`);
    const file = path.resolve(this.root, ...parts);
    const rootReal = await fs.realpath(this.root).catch(() => this.root);
    // Symlinks: the deepest existing ancestor (the file itself when it exists) must stay inside.
    let probe = file;
    for (;;) {
      const real = await fs.realpath(probe).catch(() => null);
      if (real !== null) {
        if (real !== rootReal && !real.startsWith(rootReal + path.sep))
          throw new InvalidNotePathError(`Invalid note path "${rel}"`);
        return file;
      }
      probe = path.dirname(probe);
    }
  }
}
