import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { InvalidNotePathError, NotePathNotFoundError, NotesService } from "./notes.service";

function setup() {
  const base = mkdtempSync(path.join(os.tmpdir(), "notes-"));
  const vault = path.join(base, "vault");
  mkdirSync(path.join(vault, "a"), { recursive: true });
  mkdirSync(path.join(vault, ".obsidian"));
  writeFileSync(path.join(vault, "a", "x.md"), "hello");
  writeFileSync(path.join(vault, ".obsidian", "h.md"), "hidden");
  writeFileSync(path.join(base, "secret.md"), "secret");
  symlinkSync(base, path.join(vault, "link"));
  return new NotesService(vault, path.join(base, "pins.json"));
}

describe("NotesService", () => {
  it("lists visible md notes, reads and overwrites an existing one", async () => {
    const s = setup();
    expect(await s.tree()).toEqual(["a/x.md"]);
    expect(await s.read("a/x.md")).toBe("hello");
    await s.write("a/x.md", "bye");
    expect(await s.read("a/x.md")).toBe("bye");
  });

  it("refuses traversal, non-md, dot-folders and symlink escapes", async () => {
    const s = setup();
    for (const p of [
      "../secret.md",
      "/etc/passwd.md",
      "a/x.txt",
      ".obsidian/h.md",
      "link/secret.md",
    ])
      await expect(s.read(p)).rejects.toBeInstanceOf(InvalidNotePathError);
    await expect(s.write("link/new.md", "x")).rejects.toBeInstanceOf(InvalidNotePathError);
  });

  it("does not create notes and persists pins deduped", async () => {
    const s = setup();
    await expect(s.write("a/new.md", "x")).rejects.toBeInstanceOf(NotePathNotFoundError);
    expect(await s.pins()).toEqual({ paths: [] });
    expect(await s.setPins({ paths: ["a/x.md", "a/x.md"] })).toEqual({ paths: ["a/x.md"] });
    expect(await s.pins()).toEqual({ paths: ["a/x.md"] });
  });
});
