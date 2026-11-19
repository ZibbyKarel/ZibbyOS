import { ZibbySectionTestId } from "@zibby/design-system";
import { afterEach, describe, expect, it } from "vitest";
import { readOrbOrigin } from "./orbOrigin";

function mountHeader(rect: Partial<DOMRect> | null) {
  document.body.innerHTML = `<header><span data-testid="${ZibbySectionTestId.OrbSlot}"></span></header>`;
  const orb = document.querySelector(`[data-testid="${ZibbySectionTestId.OrbSlot}"]`);
  if (orb && rect) {
    orb.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 0, height: 0, ...rect }) as DOMRect;
  }
}

describe("readOrbOrigin", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is the viewport centre of the header's Zibby section orb", () => {
    mountHeader({ left: 20, top: 10, width: 12, height: 12 });
    expect(readOrbOrigin()).toEqual({ x: 26, y: 16 });
  });

  it("is null without the orb", () => {
    document.body.innerHTML = "<div></div>";
    expect(readOrbOrigin()).toBeNull();
  });

  it("is null when the orb is not laid out", () => {
    mountHeader({ left: 0, top: 0, width: 0, height: 0 });
    expect(readOrbOrigin()).toBeNull();
  });
});
