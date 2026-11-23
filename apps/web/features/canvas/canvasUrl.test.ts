import { describe, expect, it } from "vitest";
import { buildCanvasUrls, resolveCanvasBase } from "./canvasUrl";

describe("resolveCanvasBase", () => {
  it("localhost: canvas url wins, else API port + 1", () => {
    expect(
      resolveCanvasBase({ pageHostname: "localhost", canvasUrl: "http://localhost:4334/" }),
    ).toBe("http://localhost:4334");
    expect(resolveCanvasBase({ pageHostname: "localhost", apiUrl: "http://localhost:3333" })).toBe(
      "http://localhost:3334",
    );
  });
  it("remote page: only the remote url, none otherwise", () => {
    expect(
      resolveCanvasBase({
        pageHostname: "mac.ts.net",
        remoteUrl: "https://mac.ts.net:8444",
        canvasUrl: "http://localhost:3334",
      }),
    ).toBe("https://mac.ts.net:8444");
    expect(resolveCanvasBase({ pageHostname: "mac.ts.net", canvasUrl: "http://x:1" })).toBeNull();
  });
});

describe("buildCanvasUrls", () => {
  it("localhost base is host-based and isolated", () => {
    expect(buildCanvasUrls("http://localhost:3334", "abc1234567", 2)).toEqual({
      frame: "http://abc1234567.canvas.localhost:3334/v2/",
      external: "http://localhost:3334/a/abc1234567/v2/",
      isolated: true,
    });
  });
  it("other base is path-based and not isolated", () => {
    const external = "https://mac.ts.net:8444/a/abc1234567/v1/";
    expect(buildCanvasUrls("https://mac.ts.net:8444", "abc1234567", 1)).toEqual({
      frame: external,
      external,
      isolated: false,
    });
  });
  it("no base means no links", () => {
    expect(buildCanvasUrls(null, "abc1234567", 1)).toEqual({
      frame: null,
      external: null,
      isolated: false,
    });
  });
});
