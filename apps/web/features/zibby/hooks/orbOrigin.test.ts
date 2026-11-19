import { AppHeaderTestId, ZibbyChipTestId } from "@zibby/design-system";
import { afterEach, describe, expect, it } from "vitest";
import { readOrbOrigin } from "./orbOrigin";

function mountHeader(rect: Partial<DOMRect> | null) {
  document.body.innerHTML = `<header data-testid="${AppHeaderTestId.Root}"><span data-testid="${ZibbyChipTestId.Orb}"></span></header>`;
  const orb = document.querySelector(`[data-testid="${ZibbyChipTestId.Orb}"]`);
  if (orb && rect) {
    orb.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 0, height: 0, ...rect }) as DOMRect;
  }
}

describe("readOrbOrigin", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is the viewport centre of the header's mini orb", () => {
    mountHeader({ left: 20, top: 10, width: 12, height: 12 });
    expect(readOrbOrigin()).toEqual({ x: 26, y: 16 });
  });

  it("is null without a header orb (the phone toolbar)", () => {
    document.body.innerHTML = "<div></div>";
    expect(readOrbOrigin()).toBeNull();
  });

  it("is null when the orb is not laid out", () => {
    mountHeader({ left: 0, top: 0, width: 0, height: 0 });
    expect(readOrbOrigin()).toBeNull();
  });

  it("ignores an orb outside the header", () => {
    document.body.innerHTML = `<span data-testid="${ZibbyChipTestId.Orb}"></span>`;
    expect(readOrbOrigin()).toBeNull();
  });
});
