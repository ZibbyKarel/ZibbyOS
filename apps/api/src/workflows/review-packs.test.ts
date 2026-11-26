import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ReviewPack, selectReviewPacks, stageReviewPacks } from "./review-packs";

const pack = (over: Partial<ReviewPack>): ReviewPack => ({
  type: "review-pack",
  lane: "TEST",
  title: "t",
  paths: [],
  body: "",
  ...over,
});
const lanes = (packs: ReviewPack[]) => packs.map((p) => p.lane);

describe("selectReviewPacks", () => {
  const run = { projectId: "shop", companyId: "acme" };

  it("keeps company-only and company+project packs that match, drops the rest", () => {
    const got = selectReviewPacks(
      [
        pack({ lane: "A", company: "acme" }),
        pack({ lane: "B", company: "acme", project: "shop" }),
        pack({ lane: "C", company: "acme", project: "other" }),
        pack({ lane: "D", company: "globex" }),
        pack({ lane: "E" }),
        pack({ lane: "F", company: "acme", type: "knowledge" }),
        pack({ lane: "G", project: "shop" }),
      ],
      run,
    );
    expect(lanes(got)).toEqual(["A", "B", "G"]);
  });

  it("a company pack never matches a run without a company", () => {
    expect(selectReviewPacks([pack({ company: "acme" })], { projectId: "shop" })).toEqual([]);
  });

  it("sorts by order (missing last), then lane", () => {
    const got = selectReviewPacks(
      [
        pack({ lane: "Z", company: "acme" }),
        pack({ lane: "B", company: "acme", order: 50 }),
        pack({ lane: "A", company: "acme" }),
        pack({ lane: "C", company: "acme", order: 10 }),
      ],
      run,
    );
    expect(lanes(got)).toEqual(["C", "B", "A", "Z"]);
  });
});

describe("stageReviewPacks", () => {
  let vaultDir: string;
  let stageDir: string;
  const write = (name: string, text: string) =>
    fs.writeFile(path.join(vaultDir, "knowledge", "review-packs", name), text);

  beforeEach(async () => {
    vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), "packs-vault-"));
    stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "packs-stage-"));
    await fs.mkdir(path.join(vaultDir, "knowledge", "review-packs"), { recursive: true });
  });
  afterEach(async () => {
    await fs.rm(vaultDir, { recursive: true, force: true });
    await fs.rm(stageDir, { recursive: true, force: true });
  });

  it("writes lane bodies without frontmatter, an INDEX and the offered.json manifest", async () => {
    await write(
      "acme-test.md",
      [
        "---",
        'title: "Review pack — Acme · Tests"',
        "type: review-pack",
        "company: acme",
        "lane: TEST",
        "order: 50",
        'paths: ["**/*.php"]',
        'runs: "always for code diffs"',
        'source: "acme/shop@abc lanes/test.md"',
        "snapshot: 2026-11-26",
        "---",
        "- **TEST-01** · first rule",
        "- **TEST-02** · second | rule",
      ].join("\n"),
    );
    await write("other-test.md", "---\ntype: review-pack\ncompany: globex\nlane: SEC\n---\n- x\n");
    await write("bad-lane.md", "---\ntype: review-pack\ncompany: acme\nlane: ../x\n---\nx\n");
    await write("idx.md", "---\ntype: review-pack\ncompany: acme\nlane: INDEX\n---\nx\n");

    const staged = await stageReviewPacks({
      vaultDir,
      stageDir,
      projectId: "shop",
      companyId: "acme",
    });
    expect(staged?.dirAbs).toBe(path.join(stageDir, "review-rules"));
    expect(staged?.packs.map((p) => p.lane)).toEqual(["TEST"]);
    const dir = staged!.dirAbs;
    expect((await fs.readdir(dir)).sort()).toEqual(["INDEX.md", "offered.json", "test.md"]);
    const lane = await fs.readFile(path.join(dir, "test.md"), "utf8");
    expect(lane).not.toContain("type: review-pack");
    expect(lane.startsWith("- **TEST-01**")).toBe(true);
    const index = await fs.readFile(path.join(dir, "INDEX.md"), "utf8");
    expect(index).toContain(
      "| TEST | Review pack — Acme · Tests | test.md | 2 | **/*.php | always for code diffs |",
    );
    const offered = JSON.parse(await fs.readFile(path.join(dir, "offered.json"), "utf8"));
    expect(offered).toMatchObject({
      projectId: "shop",
      companyId: "acme",
      packs: [
        {
          lane: "TEST",
          file: "test.md",
          source: "acme/shop@abc lanes/test.md",
          snapshot: "2026-11-26",
          paths: ["**/*.php"],
          ruleIds: ["TEST-01", "TEST-02"],
        },
      ],
    });
  });

  it("replaces a stale review-rules dir on a retry", async () => {
    await write(
      "p.md",
      "---\ntype: review-pack\nproject: shop\nlane: API\n---\n- **API-01** · x\n",
    );
    await fs.mkdir(path.join(stageDir, "review-rules"));
    await fs.writeFile(path.join(stageDir, "review-rules", "stale.md"), "old");
    await stageReviewPacks({ vaultDir, stageDir, projectId: "shop" });
    expect((await fs.readdir(path.join(stageDir, "review-rules"))).sort()).toEqual([
      "INDEX.md",
      "api.md",
      "offered.json",
    ]);
  });

  it("returns null and stages nothing when no pack matches or the folder is missing", async () => {
    await write("p.md", "---\ntype: review-pack\ncompany: acme\nlane: API\n---\nx\n");
    expect(await stageReviewPacks({ vaultDir, stageDir, projectId: "shop" })).toBeNull();
    await fs.rm(path.join(vaultDir, "knowledge"), { recursive: true });
    expect(await stageReviewPacks({ vaultDir, stageDir, projectId: "shop" })).toBeNull();
    expect(await fs.readdir(stageDir)).toEqual([]);
  });
});
