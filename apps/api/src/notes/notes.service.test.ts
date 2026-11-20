import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { NotePinsSchema } from "@zibby/contracts";
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

  it("reads a legacy {paths} pins file", async () => {
    const base = mkdtempSync(path.join(os.tmpdir(), "notes-"));
    writeFileSync(path.join(base, "pins.json"), JSON.stringify({ paths: ["a.md"] }));
    const s = new NotesService(path.join(base, "vault"), path.join(base, "pins.json"));
    expect(await s.pins()).toEqual({ paths: ["a.md"] });
  });

  it("stores trimmed pin labels, drops empty and unpinned ones, omits empty labels", async () => {
    const s = setup();
    const out = await s.setPins({
      paths: ["a.md", "b.md", "a.md"],
      labels: { "a.md": "  Plán  ", "b.md": "   ", "c.md": "x" },
    });
    expect(out).toEqual({ paths: ["a.md", "b.md"], labels: { "a.md": "Plán" } });
    expect(await s.pins()).toEqual(out);
    // unpinning drops the label
    expect(await s.setPins({ paths: ["b.md"], labels: { "a.md": "Plán" } })).toEqual({
      paths: ["b.md"],
    });
  });

  it("rejects a pin label longer than 120 chars", () => {
    const labels = { "a.md": "x".repeat(121) };
    expect(NotePinsSchema.safeParse({ paths: ["a.md"], labels }).success).toBe(false);
    expect(
      NotePinsSchema.safeParse({ paths: ["a.md"], labels: { "a.md": "x".repeat(120) } }).success,
    ).toBe(true);
  });
});
