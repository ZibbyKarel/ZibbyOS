import { describe, expect, it } from "vitest";
import { findPrUrl } from "./prUrl";

describe("findPrUrl", () => {
  it("finds the URL gh pr create prints", () => {
    expect(findPrUrl("Creating pull request…\nhttps://github.com/acme/app/pull/42\n")).toBe(
      "https://github.com/acme/app/pull/42",
    );
  });

  it("finds a GitLab merge request", () => {
    expect(findPrUrl("MR: https://gitlab.com/grp/sub/app/-/merge_requests/7.")).toBe(
      "https://gitlab.com/grp/sub/app/-/merge_requests/7",
    );
  });

  it("strips surrounding markdown / punctuation and takes the last one", () => {
    expect(
      findPrUrl("see (https://github.com/a/b/pull/1) then [PR](https://github.com/a/b/pull/2)"),
    ).toBe("https://github.com/a/b/pull/2");
  });

  it("is undefined without a PR URL", () => {
    expect(findPrUrl("https://github.com/a/b/issues/3")).toBeUndefined();
    expect(findPrUrl(undefined)).toBeUndefined();
  });
});
