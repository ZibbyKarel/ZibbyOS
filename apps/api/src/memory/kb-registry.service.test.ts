import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { KnowledgeBaseEntry } from "@zibby/contracts";
import { KnowledgeBaseRegistrySchema } from "@zibby/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KB_REGISTRY_ID, KbRegistryService } from "./kb-registry.service";
import { VaultService } from "./vault.service";

const entry = (over: Partial<KnowledgeBaseEntry> = {}): KnowledgeBaseEntry => ({
  id: "devrel",
  name: "DevRel",
  path: "/kb/devrel",
  readOnly: true,
  root: "wiki/INDEX.md",
  context: "team-context.md",
  domain: "work",
  description: "DevRel | questions",
  teamId: "devrel",
  ...over,
});

describe("KnowledgeBaseRegistrySchema", () => {
  it("applies defaults and rejects duplicate ids / relative paths", () => {
    const ok = KnowledgeBaseRegistrySchema.parse({
      kbs: [{ id: "a", name: "A", path: "/x", readOnly: true }],
    });
    expect(ok.kbs[0]).toMatchObject({
      root: "wiki/INDEX.md",
      context: "team-context.md",
      domain: "work",
    });
    const dup = { id: "a", name: "A", path: "/x", readOnly: true };
    expect(KnowledgeBaseRegistrySchema.safeParse({ kbs: [dup, dup] }).success).toBe(false);
    expect(KnowledgeBaseRegistrySchema.safeParse({ kbs: [{ ...dup, path: "rel" }] }).success).toBe(
      false,
    );
    for (const root of ["../etc/passwd", "/abs.md", "wiki/../../x.md"])
      expect(KnowledgeBaseRegistrySchema.safeParse({ kbs: [{ ...dup, root }] }).success).toBe(
        false,
      );
  });
});

describe("KbRegistryService", () => {
  let dir: string;
  let service: KbRegistryService;
  const file = () => path.join(dir, "knowledge", `${KB_REGISTRY_ID}.md`);

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "zibby-kb-registry-"));
    service = new KbRegistryService(new VaultService(dir));
  });
  afterEach(() => fs.rm(dir, { recursive: true, force: true }));

  it("is empty when the note is missing", async () => {
    expect(await service.list()).toEqual([]);
    expect(await service.forTeam("devrel")).toBeUndefined();
  });

  it("round-trips upsert/get/forTeam/removeForTeam and renders the table body", async () => {
    await service.upsert(entry());
    await service.upsert(entry({ id: "other", name: "Other", teamId: undefined }));
    expect(await service.get("devrel")).toEqual(entry());
    expect((await service.forTeam("devrel"))?.id).toBe("devrel");
    const raw = await fs.readFile(file(), "utf8");
    expect(raw).toContain(
      "| devrel | DevRel | DevRel \\| questions | /kb/devrel | devrel | work |",
    );
    // upsert replaces by id
    await service.upsert(entry({ name: "Renamed" }));
    expect((await service.list()).map((k) => k.name).sort()).toEqual(["Other", "Renamed"]);
    await service.removeForTeam("devrel");
    expect((await service.list()).map((k) => k.id)).toEqual(["other"]);
  });

  it("treats an invalid note as empty and refuses to overwrite it", async () => {
    await fs.mkdir(path.dirname(file()), { recursive: true });
    await fs.writeFile(file(), "---\nkbs:\n  - id: 1\n---\nhand edited\n", "utf8");
    expect(await service.list()).toEqual([]);
    await expect(service.upsert(entry())).rejects.toThrow(/invalid/);
    expect(await fs.readFile(file(), "utf8")).toContain("hand edited");
  });
});
