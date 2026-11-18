import { describe, expect, it } from "vitest";
import { issueWebUrl, parsePrNumber, parsePrUrl, prWebUrl } from "./git-host-url";

const gh = { kind: "github", repo: "acme/web", token: "t" } as const;
const gl = { kind: "gitlab", host: "gitlab.example.com", repo: "g/sub/app" } as const;

describe("git-host-url", () => {
  it("builds web urls for both hosts", () => {
    expect(prWebUrl(gh, 7)).toBe("https://github.com/acme/web/pull/7");
    expect(issueWebUrl(gh, 7)).toBe("https://github.com/acme/web/issues/7");
    expect(prWebUrl(gl, 7)).toBe("https://gitlab.example.com/g/sub/app/-/merge_requests/7");
    expect(issueWebUrl(gl, 7)).toBe("https://gitlab.example.com/g/sub/app/-/issues/7");
  });

  it("parses PR urls of both hosts", () => {
    expect(parsePrUrl("https://github.com/acme/web/pull/12")).toEqual({
      host: "github.com",
      repo: "acme/web",
      number: 12,
      kind: "github",
    });
    expect(parsePrUrl("https://GitLab.Example.com/g/sub/app/-/merge_requests/3/diffs")).toEqual({
      host: "gitlab.example.com",
      repo: "g/sub/app",
      number: 3,
      kind: "gitlab",
    });
  });

  it("returns null for non-PR urls and garbage", () => {
    expect(parsePrUrl("https://github.com/acme/web/issues/1")).toBeNull();
    expect(parsePrUrl("https://gitlab.example.com/g/app/-/issues/1")).toBeNull();
    expect(parsePrUrl("nope")).toBeNull();
    expect(parsePrNumber("nope")).toBeNull();
  });

  it("parsePrNumber extracts the number", () => {
    expect(parsePrNumber("https://github.com/acme/web/pull/12")).toBe(12);
    expect(parsePrNumber("https://h.io/a/b/-/merge_requests/9")).toBe(9);
  });
});
