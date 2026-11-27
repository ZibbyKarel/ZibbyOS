import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KbRegistryService } from "../memory/kb-registry.service";
import { VaultService } from "../memory/vault.service";
import { TeamConflictError, TeamNotFoundError } from "./teams.errors";
import { TeamsStorageService } from "./teams.storage.service";

describe("TeamsStorageService", () => {
  let dir: string;
  let vaultDir: string;
  let registry: KbRegistryService;
  let service: TeamsStorageService;

  const base = { id: "devrel", name: "DevRel", desc: "A test team" };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "zibby-teams-"));
    vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), "zibby-teams-vault-"));
    registry = new KbRegistryService(new VaultService(vaultDir));
    service = new TeamsStorageService(dir, registry);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(vaultDir, { recursive: true, force: true });
  });

  it("starts with an empty registry when no manifest exists", async () => {
    expect(await service.list()).toEqual([]);
  });

  it("creates and reads back a team with a knowledge base", async () => {
    await service.create({
      id: "devrel",
      name: "DevRel",
      companyId: "shoptet",
      knowledgeBase: { kind: "vault", path: "/tmp/kb", readOnly: true },
    });
    const team = await service.get("devrel");
    expect(team.knowledgeBase).toEqual({ kind: "vault", path: "/tmp/kb", readOnly: true });
  });

  it("stores, clears (null) and searches a slug", async () => {
    await service.create(base);
    expect((await service.update("devrel", { slug: "devrel-team" })).slug).toBe("devrel-team");
    expect((await service.search("devrel-t")).map((t) => t.id)).toEqual(["devrel"]);
    await service.update("devrel", { slug: null });
    expect("slug" in (await service.get("devrel"))).toBe(false);
  });

  it("stores and clears (null) a board", async () => {
    await service.create(base);
    expect((await service.update("devrel", { board: "CZ3TDR1" })).board).toBe("CZ3TDR1");
    await service.update("devrel", { board: null });
    expect("board" in (await service.get("devrel"))).toBe(false);
  });

  it("externalizes, inlines and clears (null) a logo (todo #21)", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
    const logo = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    await service.create({ ...base, logo });
    const manifest = JSON.parse(await fs.readFile(path.join(dir, "_teams.json"), "utf8"));
    expect(manifest[0].logo).toBe("assets/devrel.png");
    expect((await service.get("devrel")).logo).toBe(logo);
    await service.update("devrel", { logo: null });
    expect((await service.get("devrel")).logo).toBeUndefined();
    await expect(fs.stat(path.join(dir, "assets", "devrel.png"))).rejects.toThrow();
  });

  it("rejects a duplicate id (conflict)", async () => {
    await service.create(base);
    await expect(service.create(base)).rejects.toBeInstanceOf(TeamConflictError);
  });

  it("partially updates an existing team, keeping its id", async () => {
    await service.create(base);
    const updated = await service.update("devrel", { desc: "renamed" });
    expect(updated).toMatchObject({ id: "devrel", desc: "renamed" });
  });

  describe("companyId link/unlink (clear semantics)", () => {
    it("sets companyId via a normal patch", async () => {
      await service.create(base);
      const updated = await service.update("devrel", { companyId: "shoptet" });
      expect(updated.companyId).toBe("shoptet");
    });

    it("clears a linked companyId when the patch sends `null`", async () => {
      await service.create({ ...base, companyId: "shoptet" });
      const updated = await service.update("devrel", { companyId: null });
      expect(updated.companyId).toBeUndefined();
    });

    it("leaves companyId untouched when the patch omits the key entirely", async () => {
      await service.create({ ...base, companyId: "shoptet" });
      const updated = await service.update("devrel", { desc: "moved" });
      expect(updated.companyId).toBe("shoptet");
    });
  });

  describe("knowledgeBase clear semantics", () => {
    const kb = { kind: "vault" as const, path: "/tmp/kb", readOnly: true as const };

    it("sets knowledgeBase via a normal patch", async () => {
      await service.create(base);
      const updated = await service.update("devrel", { knowledgeBase: kb });
      expect(updated.knowledgeBase).toEqual(kb);
    });

    it("clears a linked knowledgeBase when the patch sends `null`", async () => {
      await service.create({ ...base, knowledgeBase: kb });
      const updated = await service.update("devrel", { knowledgeBase: null });
      expect(updated.knowledgeBase).toBeUndefined();
    });

    it("leaves knowledgeBase untouched when the patch omits the key entirely", async () => {
      await service.create({ ...base, knowledgeBase: kb });
      const updated = await service.update("devrel", { name: "DevRel Team" });
      expect(updated.knowledgeBase).toEqual(kb);
    });
  });

  describe("knowledgeBase lives in the mozek registry", () => {
    const kb = { kind: "vault" as const, path: "/tmp/kb", readOnly: true as const };
    const manifest = async () =>
      JSON.parse(await fs.readFile(path.join(dir, "_teams.json"), "utf8"));

    it("never persists knowledgeBase in _teams.json; derives it from the registry", async () => {
      await service.create({ ...base, companyId: "shoptet", knowledgeBase: kb });
      expect((await manifest())[0]).not.toHaveProperty("knowledgeBase");
      expect(await registry.forTeam("devrel")).toMatchObject({
        id: "devrel",
        name: "DevRel",
        teamId: "devrel",
        companyId: "shoptet",
        path: "/tmp/kb",
        root: "wiki/INDEX.md",
        context: "team-context.md",
      });
      expect((await service.get("devrel")).knowledgeBase).toEqual(kb);
    });

    it("keeps curated entry fields on update and carries root/context into the source", async () => {
      await service.create({ ...base, knowledgeBase: kb });
      const entry = await registry.forTeam("devrel");
      await registry.upsert({
        ...entry!,
        name: "Curated",
        description: "answers DevRel questions",
        root: "INDEX.md",
      });
      const updated = await service.update("devrel", {
        knowledgeBase: { ...kb, path: "/tmp/kb2" },
      });
      expect(updated.knowledgeBase).toEqual({ ...kb, path: "/tmp/kb2", root: "INDEX.md" });
      expect(await registry.get("devrel")).toMatchObject({
        name: "Curated",
        description: "answers DevRel questions",
        path: "/tmp/kb2",
      });
    });

    it("adopts a hand-written entry named after the team", async () => {
      await registry.upsert({
        id: "devrel",
        name: "Hand",
        path: "/tmp/hand",
        readOnly: true,
        root: "wiki/INDEX.md",
        context: "team-context.md",
        domain: "work",
        description: "mine",
      });
      await service.create({ ...base, knowledgeBase: kb });
      expect(await registry.list()).toHaveLength(1);
      expect(await registry.get("devrel")).toMatchObject({ name: "Hand", teamId: "devrel" });
    });

    it("clears the entry on `null` and when the team is deleted", async () => {
      await service.create({ ...base, knowledgeBase: kb });
      await service.update("devrel", { knowledgeBase: null });
      expect(await registry.list()).toEqual([]);
      await service.update("devrel", { knowledgeBase: kb });
      await service.delete("devrel");
      expect(await registry.list()).toEqual([]);
    });

    describe("boot migration (M5)", () => {
      const legacy = [
        {
          ...base,
          companyId: "shoptet",
          knowledgeBase: { ...kb, gitRemote: "git@github.com:o/r.git" },
        },
      ];

      it("moves knowledgeBase into the registry, strips the manifest, and is idempotent", async () => {
        await fs.writeFile(path.join(dir, "_teams.json"), JSON.stringify(legacy), "utf8");
        await service.migrateKnowledgeBases();
        expect((await manifest())[0]).not.toHaveProperty("knowledgeBase");
        expect(await registry.forTeam("devrel")).toMatchObject({
          id: "devrel",
          companyId: "shoptet",
          gitRemote: "git@github.com:o/r.git",
        });
        const before = await fs.readFile(path.join(dir, "_teams.json"), "utf8");
        await service.migrateKnowledgeBases();
        expect(await fs.readFile(path.join(dir, "_teams.json"), "utf8")).toBe(before);
        expect(await registry.list()).toHaveLength(1);
        expect((await service.get("devrel")).knowledgeBase?.path).toBe("/tmp/kb");
      });

      it("does not overwrite an existing entry for the team", async () => {
        await service.create({ ...base, knowledgeBase: kb });
        const file = path.join(dir, "_teams.json");
        await fs.writeFile(
          file,
          JSON.stringify([{ ...base, knowledgeBase: { ...kb, path: "/tmp/other" } }]),
          "utf8",
        );
        await service.migrateKnowledgeBases();
        expect((await registry.get("devrel"))?.path).toBe("/tmp/kb");
        expect((await manifest())[0]).not.toHaveProperty("knowledgeBase");
      });

      it("keeps the manifest data when the registry is unwritable (invalid note)", async () => {
        await fs.mkdir(path.join(vaultDir, "knowledge"), { recursive: true });
        await fs.writeFile(
          path.join(vaultDir, "knowledge", "knowledge-bases.md"),
          "---\nkbs: nonsense\n---\n",
          "utf8",
        );
        await fs.writeFile(path.join(dir, "_teams.json"), JSON.stringify(legacy), "utf8");
        await service.onModuleInit(); // never throws
        expect((await manifest())[0]).toHaveProperty("knowledgeBase");
      });
    });
  });

  it("throws when updating or getting a missing team", async () => {
    await expect(service.get("nope")).rejects.toBeInstanceOf(TeamNotFoundError);
    await expect(service.update("nope", { name: "x" })).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it("keeps the list sorted by id", async () => {
    await service.create({ id: "zeta", name: "Zeta" });
    await service.create({ id: "alpha", name: "Alpha" });
    expect((await service.list()).map((t) => t.id)).toEqual(["alpha", "zeta"]);
  });

  it("deletes a team, leaving the rest", async () => {
    await service.create(base);
    await service.create({ ...base, id: "globex", name: "Globex" });
    await service.delete("devrel");
    expect((await service.list()).map((t) => t.id)).toEqual(["globex"]);
  });

  it("allows deleting a team even if a project would still reference it (no cascade)", async () => {
    // Teams storage has no notion of projects; this asserts delete never
    // consults or blocks on anything beyond its own registry (mirrors the
    // companies Phase 69/70 decision).
    await service.create(base);
    await expect(service.delete("devrel")).resolves.toBeUndefined();
  });

  it("throws when deleting a missing team", async () => {
    await expect(service.delete("nope")).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it("searches teams by id, name and desc", async () => {
    await service.create(base);
    await service.create({ id: "globex", name: "Globex", desc: "Unrelated" });
    expect((await service.search("devrel")).map((t) => t.id)).toEqual(["devrel"]);
    expect((await service.search("test team")).map((t) => t.id)).toEqual(["devrel"]);
    expect(await service.search("zzz")).toEqual([]);
  });

  it("survives a hand-corrupted manifest by reading it as empty", async () => {
    await fs.writeFile(path.join(dir, "_teams.json"), "{ not json", "utf8");
    expect(await service.list()).toEqual([]);
  });

  it("drops corrupt rows instead of failing the listing", async () => {
    await service.create({ id: "devrel", name: "DevRel" });
    const file = path.join(dir, "_teams.json");
    const rows = JSON.parse(await fs.readFile(file, "utf8")) as unknown[];
    await fs.writeFile(file, JSON.stringify([...rows, { id: "", name: "" }], null, 2));
    expect((await service.list()).map((t) => t.id)).toEqual(["devrel"]);
  });
});
