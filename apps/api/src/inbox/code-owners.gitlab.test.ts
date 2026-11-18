import { describe, expect, it } from "vitest";
import { fakeGlab } from "../../test/gitlab-fake";
import { CodeOwnersService } from "./code-owners.service";
import { gitlabCodeOwnersOf } from "./code-owners.gitlab";

const link = { host: "gl.example.com", repo: "grp/app", username: "karel.zibar" };
const files = ["docs/a.md", "src/b.ts", "README.md"].map((filename) => ({ filename }));

describe("gitlabCodeOwnersOf", () => {
  const text = [
    "* @everyone",
    "[Docs] @alice @grp/writers",
    "docs/",
    "README.md @bob",
    "^[Optional docs][2]",
    "docs/ @carol",
    "[docs]",
    "src/ @dave",
  ].join("\n");

  it("applies a section's default owners to entries that name none", () => {
    expect(gitlabCodeOwnersOf(text, "docs/a.md")).toEqual(
      expect.arrayContaining(["@alice", "@grp/writers"]),
    );
  });

  it("an entry with its own owners ignores the section default", () => {
    expect(gitlabCodeOwnersOf(text, "README.md")).toEqual(["@everyone", "@bob"]);
  });

  it("adds up owners across sections; optional and approval-count headers are headers, same-name sections merge", () => {
    expect(gitlabCodeOwnersOf(text, "docs/a.md").sort()).toEqual(
      ["@alice", "@carol", "@everyone", "@grp/writers"].sort(),
    );
    // `[docs]` merges into `[Docs]`: its `src/` entry is in the same section
    expect(gitlabCodeOwnersOf(text, "src/b.ts").sort()).toEqual(["@dave", "@everyone"]);
  });

  it("within a section the last match wins", () => {
    expect(gitlabCodeOwnersOf("[S] @d\n*.ts @a\nsrc/*.ts @b\n", "src/x.ts")).toEqual(["@b"]);
  });

  it("a glob like [abc].txt is a pattern, not a header", () => {
    expect(gitlabCodeOwnersOf("[abc].txt @a\n", "a.txt")).toEqual([]);
  });
});

describe("CodeOwnersService.reviewScopeGitlab", () => {
  const codeowners = "[Docs] @grp/writers\ndocs/\n[Core]\nsrc/ @other\nREADME.md @karel.zibar\n";
  const routes = (extra: Parameters<typeof fakeGlab>[0] = []) =>
    fakeGlab([
      [/repository\/files\/CODEOWNERS\/raw\?ref=main$/, { raw: codeowners }],
      [/groups\/grp\/writers\/members\/all/, [{ username: "Karel.Zibar", access_level: 30 }]],
      ...extra,
    ]);

  it("keeps the files I own directly or through a group (members/all), from the base ref", async () => {
    const { client, paths } = routes();
    const scope = await new CodeOwnersService(undefined, client).reviewScopeGitlab(
      link,
      "main",
      files,
    );
    expect(scope).toEqual({
      kind: "mine",
      files: ["docs/a.md", "README.md"],
      outOfScope: 1,
      owners: ["@grp/writers", "@karel.zibar"],
      source: "CODEOWNERS@main",
    });
    expect(paths().some((p) => p.includes("groups/grp/writers/members/all"))).toBe(true);
  });

  it("a group I am not in does not make files mine", async () => {
    const { client } = fakeGlab([
      [/files\/CODEOWNERS\/raw/, { raw: "docs/ @grp/writers\n" }],
      [/groups\/grp\/writers\/members\/all/, [{ username: "someone" }]],
    ]);
    const scope = await new CodeOwnersService(undefined, client).reviewScopeGitlab(
      link,
      "main",
      files,
    );
    expect(scope).toMatchObject({ kind: "none", files: 3 });
  });

  it("looks through docs/ and .gitlab/ when the root has none; no file at all is 'no CODEOWNERS', not an error", async () => {
    const found = fakeGlab([
      [
        /files\/\.gitlab%2FCODEOWNERS\/raw|files\/\.gitlab\/CODEOWNERS\/raw/,
        { raw: "* @karel.zibar\n" },
      ],
    ]);
    expect(
      await new CodeOwnersService(undefined, found.client).reviewScopeGitlab(link, "main", files),
    ).toEqual({ kind: "all", reason: "every changed file is owned by you or your groups" });
    const none = fakeGlab([]);
    expect(
      await new CodeOwnersService(undefined, none.client).reviewScopeGitlab(link, "main", files),
    ).toEqual({ kind: "all", reason: "no CODEOWNERS in grp/app@main" });
  });

  it("without a base ref reads the project's default branch", async () => {
    const { client } = fakeGlab([
      [/projects\/grp\/app$/, { default_branch: "trunk" }],
      [/files\/CODEOWNERS\/raw\?ref=trunk$/, { raw: "* @x\n" }],
    ]);
    const scope = await new CodeOwnersService(undefined, client).reviewScopeGitlab(
      link,
      undefined,
      files,
    );
    expect(scope).toMatchObject({ kind: "none" });
  });

  it("fails open with the reason when GitLab errors (not 404)", async () => {
    const { client } = fakeGlab([[/files\/CODEOWNERS\/raw/, { status: 500 }]]);
    const scope = await new CodeOwnersService(undefined, client).reviewScopeGitlab(
      link,
      "main",
      files,
    );
    expect(scope).toMatchObject({ kind: "all", reason: expect.stringContaining("unavailable") });
  });

  it("without an integration username asks glab who is logged in", async () => {
    const { client } = routes([[/^user$/, { username: "karel.zibar" }]]);
    const scope = await new CodeOwnersService(undefined, client).reviewScopeGitlab(
      { host: link.host, repo: link.repo },
      "main",
      files,
    );
    expect(scope).toMatchObject({ kind: "mine" });
  });
});
