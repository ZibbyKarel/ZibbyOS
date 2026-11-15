import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { orbRegistrySize } from "./orbEngine";
import { ZIBBY_ORB_STATES, ZibbyOrb, ZibbyOrbTestId } from "./ZibbyOrb";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ZibbyOrb", () => {
  it("is an image with the default English label and defaults", () => {
    render(<ZibbyOrb />);
    const el = screen.getByTestId(ZibbyOrbTestId.Root);
    expect(el).toHaveRole("img");
    expect(el).toHaveAccessibleName("Zibby · ready");
    expect(el).toHaveAttribute("data-state", "ready");
    expect(el).toHaveStyle({ width: "64px", height: "64px" });
  });

  it("uses a custom label, size and state", () => {
    render(<ZibbyOrb label="Zibby listens" size={140} state="listen" />);
    const el = screen.getByTestId(ZibbyOrbTestId.Root);
    expect(el).toHaveAccessibleName("Zibby listens");
    expect(el).toHaveAttribute("data-state", "listen");
    expect(el).toHaveStyle({ width: "140px", height: "140px" });
  });

  it("hides the canvas from assistive tech and overflows the box", () => {
    render(<ZibbyOrb />);
    const canvas = screen.getByTestId(ZibbyOrbTestId.Canvas);
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveClass("pointer-events-none", "absolute");
  });

  it("exposes all 12 states", () => {
    expect(ZIBBY_ORB_STATES).toHaveLength(12);
    render(<ZibbyOrb state="needs" />);
    expect(screen.getByTestId(ZibbyOrbTestId.Root)).toHaveAccessibleName("Zibby · needs");
  });

  it("lets the consumer override the test id", () => {
    render(<ZibbyOrb data-testid="my-orb" />);
    expect(screen.getByTestId("my-orb")).toBeInTheDocument();
  });

  it("mounts, re-renders with new props and unmounts without throwing", () => {
    const { rerender, unmount } = render(<ZibbyOrb state="ready" />);
    rerender(<ZibbyOrb level={0.6} size={28} state="speak" />);
    expect(screen.getByTestId(ZibbyOrbTestId.Root)).toHaveAttribute("data-state", "speak");
    expect(() => unmount()).not.toThrow();
  });

  it("starts the shared rAF loop on first mount and stops it on last unmount", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(7);
    const caf = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const a = render(<ZibbyOrb />);
    expect(raf).toHaveBeenCalledTimes(1);
    a.unmount();
    expect(caf).toHaveBeenCalledWith(7);
    expect(orbRegistrySize()).toBe(0);
  });

  it("shares one loop between several orbs and prop changes do not restart it", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(3);
    const caf = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const a = render(<ZibbyOrb />);
    const b = render(<ZibbyOrb state="think" />);
    expect(raf).toHaveBeenCalledTimes(1);
    expect(orbRegistrySize()).toBe(2);
    a.rerender(<ZibbyOrb state="done" />);
    expect(raf).toHaveBeenCalledTimes(1);
    expect(caf).not.toHaveBeenCalled();
    a.unmount();
    expect(caf).not.toHaveBeenCalled();
    b.unmount();
    expect(caf).toHaveBeenCalledTimes(1);
  });

  it("survives a frame in jsdom (no 2d context, zero size)", () => {
    let cb: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((f) => {
      cb = f;
      return 1;
    });
    render(<ZibbyOrb />);
    expect(() => cb?.(16)).not.toThrow();
  });
});
