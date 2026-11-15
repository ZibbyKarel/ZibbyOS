import { AppHeaderTestId, BrandMarkTestId } from "@zibby/design-system";
import { afterEach, describe, expect, it } from "vitest";
import { readKnotOrigin } from "./knotOrigin";

function mountHeader(rect: Partial<DOMRect> | null) {
  document.body.innerHTML = `<header data-testid="${AppHeaderTestId.Root}"><svg><circle data-testid="${BrandMarkTestId.Knot}"></circle></svg></header>`;
  const knot = document.querySelector(`[data-testid="${BrandMarkTestId.Knot}"]`);
  if (knot && rect) {
    knot.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 0, height: 0, ...rect }) as DOMRect;
  }
}

describe("readKnotOrigin", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is the viewport centre of the header logo's knot", () => {
    mountHeader({ left: 20, top: 10, width: 12, height: 12 });
    expect(readKnotOrigin()).toEqual({ x: 26, y: 16 });
  });

  it("is null without a header mark (the phone toolbar)", () => {
    document.body.innerHTML = "<div></div>";
    expect(readKnotOrigin()).toBeNull();
  });

  it("is null when the knot is not laid out", () => {
    mountHeader({ left: 0, top: 0, width: 0, height: 0 });
    expect(readKnotOrigin()).toBeNull();
  });

  it("ignores a brand mark outside the header (e.g. the splash)", () => {
    document.body.innerHTML = `<svg><circle data-testid="${BrandMarkTestId.Knot}"></circle></svg>`;
    expect(readKnotOrigin()).toBeNull();
  });
});
