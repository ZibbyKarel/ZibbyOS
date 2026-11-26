import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CorruptLoopFileError, LoopConflictError, LoopNotFoundError } from "./loops.errors";
import { LoopsStorageService } from "./loops.storage.service";

const sampleInput = {
  id: "ship-feature",
  objective: "Ship feature Y green",
  maker: { kind: "workflow" as const, id: "delivery" },
  verifier: { kind: "claude" as const, agent: "code-reviewer" },
  maxIterations: 4,
  instructions: "Iterate until the reviewer passes it.",
};

const fileFor = (dir: string, id: string) => path.join(dir, `${id}.loop.md`);

describe("LoopsStorageService", () => {
  let dir: string;
  let service: LoopsStorageService;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "loops-test-"));
    service = new LoopsStorageService(dir);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("writes a .loop.md file with maker/verifier/maxIterations in frontmatter", async () => {
    const loop = await service.create(sampleInput);
    expect(loop.name).toBe("ship-feature");
    expect(loop.maker).toEqual({ kind: "workflow", id: "delivery" });

    const raw = await fs.readFile(fileFor(dir, "ship-feature"), "utf8");
    const parsed = matter(raw);
    expect(parsed.data.objective).toBe("Ship feature Y green");
    expect(parsed.data.maxIterations).toBe(4);
    expect(parsed.data.maker).toEqual({ kind: "workflow", id: "delivery" });
    expect(parsed.data.verifier).toEqual({ kind: "claude", agent: "code-reviewer" });
    expect(parsed.content.trim()).toBe("Iterate until the reviewer passes it.");
  });

  it("round-trips through get (frontmatter ↔ Loop)", async () => {
    await service.create(sampleInput);
    const fetched = await service.get("ship-feature");
    expect(fetched).toEqual({ ...sampleInput, name: "ship-feature" });
  });

  it("round-trips a claude verifier with a model override", async () => {
    await service.create({
      ...sampleInput,
      id: "claude-loop",
      verifier: { kind: "claude", agent: "reviewer", model: "haiku" },
    });
    const fetched = await service.get("claude-loop");
    expect(fetched.verifier).toEqual({ kind: "claude", agent: "reviewer", model: "haiku" });
  });

  it("rejects a duplicate id", async () => {
    await service.create(sampleInput);
    await expect(service.create(sampleInput)).rejects.toBeInstanceOf(LoopConflictError);
  });

  it("throws not-found for an unknown id", async () => {
    await expect(service.get("nope")).rejects.toBeInstanceOf(LoopNotFoundError);
  });

  it("treats a file with no maker as corrupt (the loop can't run without it)", async () => {
    const raw = matter.stringify("\nbody\n", {
      objective: "x",
      maxIterations: 2,
      verifier: { kind: "claude", agent: "code-reviewer" },
    });
    await fs.writeFile(fileFor(dir, "broken"), raw, "utf8");
    await expect(service.get("broken")).rejects.toBeInstanceOf(CorruptLoopFileError);
  });

  it("lists loops sorted by id, skipping corrupt files", async () => {
    await service.create(sampleInput);
    await service.create({ ...sampleInput, id: "another" });
    await fs.writeFile(fileFor(dir, "garbage"), "not: [valid", "utf8");
    const list = await service.list();
    expect(list.map((g) => g.id)).toEqual(["another", "ship-feature"]);
  });
});
