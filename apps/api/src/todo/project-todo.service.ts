import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import type { ProjectTodoItem } from "@zibby/contracts";
import { VAULT_DIR } from "../memory/vault.service";
import { isErrnoException, writeFileAtomic } from "../shared/file-storage";

// Same grammar as the zibby:todo skill's todo.py (ITEM_RE / SUBITEM_RE).
const ITEM_RE = /^((?:[-*]|\d+\.) \[)([ xX])(\] )(.*)$/;
const SUBITEM_RE = /^( {3}[a-z]\. \[)([ xX])(\] .*)$/;

interface Top {
  line: number;
  checked: boolean;
  text: string;
  subs: { line: number; checked: boolean }[];
}

/** Top-level items in file order (headings invisible: numbers are positional), each with its sub-items. */
function parse(lines: string[]): Top[] {
  const tops: Top[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = ITEM_RE.exec(lines[i] ?? "");
    if (!m) continue;
    const top: Top = { line: i, checked: m[2] !== " ", text: m[4] ?? "", subs: [] };
    for (
      let sm = SUBITEM_RE.exec(lines[i + 1] ?? "");
      sm;
      sm = SUBITEM_RE.exec(lines[i + 1] ?? "")
    ) {
      top.subs.push({ line: ++i, checked: sm[2] !== " " });
    }
    tops.push(top);
  }
  return tops;
}

/** Rewrites every checklist line as `N. [ ]` / `   a. [ ]` (todo.py `renumber_all`). */
function renumber(lines: string[]): string[] {
  const out = [...lines];
  parse(lines).forEach((top, n) => {
    const raw = out[top.line] ?? "";
    out[top.line] = raw.replace(ITEM_RE, (_m, _a, mark, _c, text) => `${n + 1}. [${mark}] ${text}`);
    top.subs.forEach((s, k) => {
      out[s.line] = (out[s.line] ?? "").replace(
        SUBITEM_RE,
        (_m, _a, mark, rest) => `   ${String.fromCharCode(97 + k)}. [${mark}${rest}`,
      );
    });
  });
  return out;
}

/** Drops done items (a done parent takes its sub-items along) and renumbers; null when nothing to drop. */
export function pruneTodoLines(lines: string[]): string[] | null {
  const drop = new Set<number>();
  for (const top of parse(lines)) {
    if (top.checked) drop.add(top.line);
    for (const s of top.subs) if (top.checked || s.checked) drop.add(s.line);
  }
  return drop.size === 0 ? null : renumber(lines.filter((_l, i) => !drop.has(i)));
}

// ponytail: CRLF files keep a trailing CR that fails the item regex; LF only for now
const split = (raw: string): string[] => raw.split("\n");

/** Reads and edits `<vault>/projects/<id>/TODO.md` (the zibby:todo skill's file). */
@Injectable()
export class ProjectTodoService {
  private readonly projectsDir: string;

  constructor(@Inject(VAULT_DIR) vaultDir: string) {
    this.projectsDir = path.join(path.resolve(vaultDir), "projects");
  }

  private file(projectId: string): string | null {
    const file = path.resolve(this.projectsDir, projectId, "TODO.md");
    // Ids are filename-safe by contract; this is the belt to that brace.
    return path.dirname(path.dirname(file)) === this.projectsDir ? file : null;
  }

  private async read(file: string): Promise<string[]> {
    try {
      return split(await fs.readFile(file, "utf8"));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") return [];
      throw error;
    }
  }

  async list(projectId: string): Promise<ProjectTodoItem[]> {
    const file = this.file(projectId);
    if (!file) return [];
    return parse(await this.read(file)).map((t, i) => ({
      number: i + 1,
      text: t.text,
      done: t.checked,
    }));
  }

  /** Flips item `n`'s checkbox in place (sub-items untouched); null when there is no such item. */
  async setDone(projectId: string, n: number, done: boolean): Promise<ProjectTodoItem | null> {
    const file = this.file(projectId);
    if (!file) return null;
    const lines = await this.read(file);
    const top = parse(lines)[n - 1];
    if (!top) return null;
    lines[top.line] = (lines[top.line] ?? "").replace(
      ITEM_RE,
      (_m, a, _mark, c, text) => `${a}${done ? "x" : " "}${c}${text}`,
    );
    await writeFileAtomic(file, lines.join("\n"));
    return { number: n, text: top.text, done };
  }

  /** Removes done items from every project's TODO.md and renumbers; returns the lines dropped. */
  async pruneAll(): Promise<number> {
    let dropped = 0;
    const dirs = await fs.readdir(this.projectsDir, { withFileTypes: true }).catch(() => []);
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const file = path.join(this.projectsDir, d.name, "TODO.md");
      const lines = await this.read(file);
      const kept = pruneTodoLines(lines);
      if (!kept) continue;
      await writeFileAtomic(file, kept.join("\n"));
      dropped += lines.length - kept.length;
    }
    return dropped;
  }
}
