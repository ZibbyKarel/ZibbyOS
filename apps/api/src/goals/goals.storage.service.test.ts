import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GoalConflictError, GoalNotFoundError, InvalidGoalError } from "./goals.errors";
import { GoalsStorageService } from "./goals.storage.service";

const input = {
  id: "my-goal",
  name: "Moje PR",
  outcome: "Všechny moje PR jsou merge-ready.",
  predicate: "Všechny PR jsou merge-ready.",
  scope: { kind: "projects" as const, projectIds: ["a", "b"] },
  cadence: { every: "weekday" as const, hour: 9 },
  cycleHours: 6,
  ceiling: "tier2" as const,
  enabled: false,
};

describe("GoalsStorageService", () => {
  let dir: string;
  let service: GoalsStorageService;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "goals-test-"));
    service = new GoalsStorageService(dir);
    await service.onModuleInit();
  });
  afterEach(() => fs.rm(dir, { recursive: true, force: true }));

  it("round-trips: frontmatter holds every field but outcome, body is the outcome", async () => {
    const created = await service.create(input);
    const parsed = matter(await fs.readFile(path.join(dir, "my-goal.goal.md"), "utf8"));
    expect(parsed.content.trim()).toBe(input.outcome);
    expect(parsed.data).not.toHaveProperty("outcome");
    expect(parsed.data).not.toHaveProperty("id");
    expect(parsed.data.scope).toEqual(input.scope);
    expect(await service.get("my-goal")).toEqual(created);
    expect(await service.list()).toEqual([created]);
  });

  it("ignores the state/ subfolder when listing", async () => {
    await service.create(input);
    await fs.mkdir(path.join(dir, "state", "my-goal"), { recursive: true });
    await fs.writeFile(path.join(dir, "state", "my-goal", "x.goal.md"), "junk");
    expect(await service.list()).toHaveLength(1);
  });

  it("rejects a duplicate id and an invalid combination", async () => {
    await service.create(input);
    await expect(service.create(input)).rejects.toBeInstanceOf(GoalConflictError);
    await expect(
      service.create({ ...input, id: "other", deadline: "2026-12-01T00:00:00.000Z" }),
    ).rejects.toBeInstanceOf(InvalidGoalError);
  });

  it("updates, bumps updatedAt, keeps createdAt, and re-validates", async () => {
    const created = await service.create(input);
    const updated = await service.update("my-goal", { enabled: true, outcome: "New." });
    expect(updated.enabled).toBe(true);
    expect(updated.outcome).toBe("New.");
    expect(updated.createdAt).toBe(created.createdAt);
    await expect(
      service.update("my-goal", { deadline: "2026-12-01T00:00:00.000Z" }),
    ).rejects.toBeInstanceOf(InvalidGoalError);
    await expect(service.update("nope", { enabled: true })).rejects.toBeInstanceOf(
      GoalNotFoundError,
    );
  });
});
