import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hydrateDirs } from "./icloud-hydrate";

describe("hydrateDirs", () => {
  let root = "";
  afterEach(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true });
  });

  it("reads every file, recursing and skipping .git", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "hydrate-"));
    await fs.mkdir(path.join(root, "a/b"), { recursive: true });
    await fs.mkdir(path.join(root, ".git"));
    await fs.writeFile(path.join(root, "a/one.md"), "1");
    await fs.writeFile(path.join(root, "a/b/two.md"), "2");
    await fs.writeFile(path.join(root, ".git/ignored"), "x");
    const seen: number[] = [];
    const result = await hydrateDirs([root], { onProgress: (done) => seen.push(done) });
    expect(result).toEqual({ total: 2, failed: [] });
    expect(seen.at(-1)).toBe(2);
  });

  it("tolerates a missing directory", async () => {
    expect(await hydrateDirs(["/nonexistent-zibby-dir"])).toEqual({ total: 0, failed: [] });
  });
});
