import { describe, expect, it } from "vitest";

import { shouldBlockCanvasFrameNavigation as block } from "./canvasFrames";

const PORT = 4334;
const HOST = `http://abcde12345.canvas.localhost:${PORT}`;
const PATH = `http://localhost:${PORT}/a/abcde12345`;

describe("shouldBlockCanvasFrameNavigation", () => {
  it("allows a host-based canvas to reload itself and its versions", () => {
    expect(block(`${HOST}/`, `${HOST}/`, PORT)).toBe(false);
    expect(block(`${HOST}/`, `${HOST}/v2/`, PORT)).toBe(false);
  });
  it("blocks another canvas id", () => {
    expect(block(`${HOST}/`, `http://zzzzz99999.canvas.localhost:${PORT}/`, PORT)).toBe(true);
  });
  it("blocks external and blank targets", () => {
    expect(block(`${HOST}/`, "https://evil.example/", PORT)).toBe(true);
    expect(block(`${HOST}/`, "about:blank", PORT)).toBe(true);
    expect(block(`${HOST}/`, "not a url", PORT)).toBe(true);
  });
  it("allows a path-based canvas to stay on its own id", () => {
    expect(block(`${PATH}/`, `${PATH}/v2/`, PORT)).toBe(false);
  });
  it("blocks a path-based canvas leaving its id", () => {
    expect(block(`${PATH}/`, `http://localhost:${PORT}/a/zzzzz99999/`, PORT)).toBe(true);
    expect(block(`${PATH}/`, `${PATH}other/`, PORT)).toBe(true);
    expect(block(`${PATH}/`, "https://evil.example/", PORT)).toBe(true);
  });
  it("never blocks frames that are not on a canvas", () => {
    expect(block("about:blank", "https://example.com/", PORT)).toBe(false);
    expect(block(undefined, "https://example.com/", PORT)).toBe(false);
    expect(block("http://localhost:3000/chat", "https://example.com/", PORT)).toBe(false);
  });
});
