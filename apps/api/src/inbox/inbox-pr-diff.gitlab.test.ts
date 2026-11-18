import type { Integration, Project } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import { fakeGlab } from "../../test/gitlab-fake";
import { MAX_DIFF_BYTES } from "../shared/cap-unified-diff";
import { InboxPrDiffService } from "./inbox-pr-diff.service";
import { composeGitlabDiff, readGitlabMrDiff } from "./inbox-pr-diff.gitlab";

const link = { host: "gl.example.com", repo: "grp/app" };

describe("readGitlabMrDiff", () => {
  it("uses raw_diffs when GitLab has it", async () => {
    const { client, paths } = fakeGlab([
      [/merge_requests\/5\/raw_diffs$/, { raw: "diff --git a/x b/x\n+x\n" }],
    ]);
    expect(await readGitlabMrDiff(client, link, 5)).toEqual({
      diff: "diff --git a/x b/x\n+x\n",
      truncated: false,
    });
    expect(paths()).toHaveLength(1);
  });

  it("caps an oversized raw diff like GitHub's", async () => {
    const big = `diff --git a/a b/a\n${"+x\n".repeat(MAX_DIFF_BYTES)}`;
    const { client } = fakeGlab([[/raw_diffs$/, { raw: big }]]);
    expect((await readGitlabMrDiff(client, link, 5)).truncated).toBe(true);
  });

  it("falls back to composing from diffs when raw_diffs is 404", async () => {
    const { client } = fakeGlab([
      [
        /merge_requests\/5\/diffs/,
        [
          { old_path: "a.ts", new_path: "a.ts", diff: "@@ -1 +1 @@\n-a\n+b\n" },
          {
            old_path: "n.ts",
            new_path: "n.ts",
            new_file: true,
            b_mode: "100755",
            diff: "@@ -0,0 +1 @@\n+n",
          },
          {
            old_path: "d.ts",
            new_path: "d.ts",
            deleted_file: true,
            a_mode: "100644",
            diff: "@@ -1 +0,0 @@\n-d\n",
          },
          { old_path: "o.ts", new_path: "p.ts", renamed_file: true, diff: "" },
        ],
      ],
    ]);
    const { diff, truncated } = await readGitlabMrDiff(client, link, 5);
    expect(truncated).toBe(false);
    expect(diff).toBe(
      [
        "diff --git a/a.ts b/a.ts",
        "--- a/a.ts",
        "+++ b/a.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b",
        "diff --git a/n.ts b/n.ts",
        "new file mode 100755",
        "--- /dev/null",
        "+++ b/n.ts",
        "@@ -0,0 +1 @@",
        "+n",
        "diff --git a/d.ts b/d.ts",
        "deleted file mode 100644",
        "--- a/d.ts",
        "+++ /dev/null",
        "@@ -1 +0,0 @@",
        "-d",
        "diff --git a/o.ts b/p.ts",
        "rename from o.ts",
        "rename to p.ts",
        "",
      ].join("\n"),
    );
  });

  it("flags truncated when GitLab withheld a patch", () => {
    expect(
      composeGitlabDiff([{ old_path: "a", new_path: "a", too_large: true, diff: "" }]).truncated,
    ).toBe(true);
  });

  it("a server error on raw_diffs is not turned into a fallback", async () => {
    const { client, paths } = fakeGlab([[/raw_diffs$/, { status: 500 }]]);
    await expect(readGitlabMrDiff(client, link, 5)).rejects.toMatchObject({ status: 500 });
    expect(paths()).toHaveLength(1);
  });

  it("a missing MR surfaces the 404 of the diffs read", async () => {
    const { client } = fakeGlab([]);
    await expect(readGitlabMrDiff(client, link, 5)).rejects.toMatchObject({ status: 404 });
  });
});

describe("InboxPrDiffService on a GitLab project", () => {
  it("routes to glab, no token read", async () => {
    const { client } = fakeGlab([[/raw_diffs$/, { raw: "diff --git a/x b/x\n" }]]);
    const gitlab = {
      id: "gl",
      config: { kind: "gitlab", host: link.host, repo: link.repo },
    } as unknown as Integration;
    const service = new InboxPrDiffService(
      { get: async () => ({ id: "app", name: "App", path: "~/app" }) as Project } as never,
      { resolveIntegrations: async () => [gitlab] } as never,
      {
        read: async () => {
          throw new Error("no credential read for gitlab");
        },
      } as never,
      undefined,
      client,
    );
    expect(await service.getDiff("app", 5)).toEqual({
      diff: "diff --git a/x b/x\n",
      truncated: false,
    });
  });
});
