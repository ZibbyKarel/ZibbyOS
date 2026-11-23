import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GENERATED_ARTIFACTS_MOC,
  recordGeneratedArtifactNote,
  syncGeneratedRootNote,
} from "./generated-artifacts-note";
import { VaultService } from "./vault.service";

describe("generated artifacts note", () => {
  let dir: string;
  let vault: VaultService;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gen-note-"));
    vault = new VaultService(dir);
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("records a pointer note with the exact path and links it from the MOC", async () => {
    const id = await recordGeneratedArtifactNote(vault, {
      root: "/gen",
      path: "/gen/coloring-books/run_1",
      kind: "folder",
      workflowId: "coloring-book",
      runId: "run_1",
      from: "book",
    });
    expect(id).toBe("generated-run-1-book");
    const note = await vault.note(id);
    expect(note.body).toContain("`/gen/coloring-books/run_1`");
    expect(note.frontmatter.path).toBe("/gen/coloring-books/run_1");
    const moc = await vault.note(GENERATED_ARTIFACTS_MOC);
    expect(moc.body).toContain("Root: `/gen`");
    expect(moc.body).toContain("[[generated-run-1-book]]");
  });

  it("is idempotent per delivery and follows a changed root without losing entries", async () => {
    const input = {
      root: "/gen",
      path: "/gen/a",
      kind: "folder" as const,
      runId: "run_2",
      from: "book",
    };
    await recordGeneratedArtifactNote(vault, input);
    await recordGeneratedArtifactNote(vault, input);
    await syncGeneratedRootNote(vault, "/new-root");
    const moc = (await vault.note(GENERATED_ARTIFACTS_MOC)).body ?? "";
    expect(moc).toContain("Root: `/new-root`");
    expect(moc).not.toContain("Root: `/gen`");
    expect(moc.match(/\[\[generated-run-2-book\]\]/g)).toHaveLength(1);
  });
});
