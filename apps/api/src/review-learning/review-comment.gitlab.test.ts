import { describe, expect, it } from "vitest";
import { fakeGlab } from "../../test/gitlab-fake";
import { fetchGitlabMrComments } from "./review-comment.gitlab";

const link = { host: "gl.example.com", repo: "grp/sub/app" };

describe("fetchGitlabMrComments", () => {
  it("maps human discussion notes, skipping system notes and notes before the cursor", async () => {
    const { client, paths } = fakeGlab([
      [
        /merge_requests\/5\/discussions/,
        [
          {
            notes: [
              {
                id: 11,
                body: "  please rename this ",
                author: { username: "karel.zibar" },
                created_at: "2026-11-18T10:00:00.000Z",
              },
              {
                id: 12,
                body: "approved",
                system: true,
                author: { username: "x" },
                created_at: "2026-11-18T10:01:00.000Z",
              },
              {
                id: 13,
                body: "old",
                author: { username: "a" },
                created_at: "2026-11-01T10:00:00.000Z",
              },
            ],
          },
          {
            notes: [
              {
                id: 14,
                body: "",
                author: { username: "a" },
                created_at: "2026-11-18T11:00:00.000Z",
              },
            ],
          },
        ],
      ],
    ]);
    const comments = await fetchGitlabMrComments(client, link, 5, "2026-11-10T00:00:00.000Z");
    expect(paths()[0]).toContain("projects/grp/sub/app/merge_requests/5/discussions");
    expect(comments).toEqual([
      {
        commentId: "dn-11",
        prNumber: 5,
        prUrl: "https://gl.example.com/grp/sub/app/-/merge_requests/5",
        commentUrl: "https://gl.example.com/grp/sub/app/-/merge_requests/5#note_11",
        author: "karel.zibar",
        at: "2026-11-18T10:00:00.000Z",
        body: "please rename this",
      },
    ]);
  });

  it("propagates a failed read", async () => {
    const { client } = fakeGlab([[/discussions/, { status: 500 }]]);
    await expect(fetchGitlabMrComments(client, link, 5, undefined)).rejects.toThrow();
  });
});
