import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { composeTeamKbSection } from "./team-kb-grounding";

describe("composeTeamKbSection", () => {
  let dir: string;
  afterEach(() => fs.rm(dir, { recursive: true, force: true }));

  it("reads the entry's own root/context files", async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "zibby-kb-ground-"));
    await fs.mkdir(path.join(dir, "docs"));
    await fs.writeFile(path.join(dir, "docs", "START.md"), "# Start\nown index", "utf8");
    await fs.writeFile(path.join(dir, "ctx.md"), "# Ctx\nown context", "utf8");
    await fs.writeFile(path.join(dir, "team-context.md"), "# Default\nnot read", "utf8");
    const out = await composeTeamKbSection({
      kind: "vault",
      path: dir,
      readOnly: true,
      root: "docs/START.md",
      context: "ctx.md",
    });
    expect(out?.body).toContain("own index");
    expect(out?.body).toContain("own context");
    expect(out?.body).not.toContain("not read");
  });
});
