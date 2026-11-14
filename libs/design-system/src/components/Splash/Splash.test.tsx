import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { BrandMarkTestId } from "../BrandMark/BrandMark";
import { SPLASH_EXIT_MS, SPLASH_INTRO_MS, SPLASH_STEP_MS, Splash, SplashTestId } from "./Splash";

const STEPS = ["Waking agents", "Loading memory", "Ready"];

describe("Splash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the bow-tie mark playing its intro, in the amber state", () => {
    render(<Splash ready={false} />);
    const mark = screen.getByTestId(BrandMarkTestId.Root);
    expect(screen.getByTestId(SplashTestId.Glyph)).toContainElement(mark);
    expect(mark).toHaveAttribute("data-intro", "true");
    expect(mark).toHaveAttribute("data-state", "blocked");
  });

  it("shows the wordmark", () => {
    render(<Splash ready={false} />);
    expect(screen.getByTestId(SplashTestId.Wordmark)).toHaveTextContent("zibby.");
  });

  it("starts in the intro and settles after the entrance", async () => {
    render(<Splash ready={false} />);
    expect(screen.getByTestId(SplashTestId.Root)).toHaveAttribute("data-phase", "intro");
    await act(async () => vi.advanceTimersByTimeAsync(SPLASH_INTRO_MS));
    expect(screen.getByTestId(SplashTestId.Root)).toHaveAttribute("data-phase", "settled");
  });

  it("ticks through the boot steps and fills the progress bar", async () => {
    render(<Splash ready={false} steps={STEPS} />);
    expect(screen.getByTestId(SplashTestId.Status)).toHaveTextContent("Waking agents…");
    expect(screen.getByTestId(SplashTestId.Progress)).toHaveAttribute("aria-valuenow", "0");

    await act(async () => vi.advanceTimersByTimeAsync(SPLASH_STEP_MS));
    expect(screen.getByTestId(SplashTestId.Status)).toHaveTextContent("Loading memory…");
    expect(screen.getByTestId(SplashTestId.Progress)).toHaveAttribute("aria-valuenow", "50");

    await act(async () => vi.advanceTimersByTimeAsync(SPLASH_STEP_MS));
    expect(screen.getByTestId(SplashTestId.Status)).toHaveTextContent(/^Ready$/);
    expect(screen.getByTestId(SplashTestId.Progress)).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders no progress bar without steps, the status as the line", () => {
    render(<Splash ready={false} status="Booting" />);
    expect(screen.queryByTestId(SplashTestId.Progress)).toBeNull();
    expect(screen.getByTestId(SplashTestId.Status)).toHaveTextContent("Booting");
  });

  it("does not exit before ready, even once the entrance has played", async () => {
    render(<Splash ready={false} />);
    await act(async () => vi.advanceTimersByTimeAsync(SPLASH_INTRO_MS + 5000));
    expect(screen.getByTestId(SplashTestId.Root)).toHaveAttribute("data-phase", "settled");
  });

  it("does not exit before the entrance has played, even when ready", async () => {
    render(<Splash ready />);
    await act(async () => vi.advanceTimersByTimeAsync(SPLASH_INTRO_MS - 1));
    expect(screen.getByTestId(SplashTestId.Root)).toHaveAttribute("data-phase", "intro");
  });

  it("exits and calls onDone once settled AND ready, setting pointer-events none immediately", async () => {
    const onDone = vi.fn();
    const { rerender } = render(<Splash onDone={onDone} ready={false} />);
    await act(async () => vi.advanceTimersByTimeAsync(SPLASH_INTRO_MS));

    rerender(<Splash ready onDone={onDone} />);
    expect(screen.getByTestId(SplashTestId.Root)).toHaveAttribute("data-phase", "exit");
    expect(screen.getByTestId(SplashTestId.Root)).toHaveStyle({ pointerEvents: "none" });
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(SPLASH_EXIT_MS));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("unmounts (renders nothing) once onDone has fired, so it never swallows clicks", async () => {
    const { rerender } = render(<Splash ready />);
    await act(async () => vi.advanceTimersByTimeAsync(SPLASH_INTRO_MS));
    await act(async () => vi.advanceTimersByTimeAsync(SPLASH_EXIT_MS));
    rerender(<Splash ready />);
    expect(screen.queryByTestId(SplashTestId.Root)).toBeNull();
  });

  it("skips to the final frame under reduced motion and fades out instantly once ready", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    try {
      const onDone = vi.fn();
      const { rerender } = render(<Splash onDone={onDone} ready={false} steps={STEPS} />);
      expect(screen.getByTestId(SplashTestId.Root)).toHaveAttribute("data-phase", "settled");
      expect(screen.getByTestId(SplashTestId.Status)).toHaveTextContent(/^Ready$/);

      rerender(<Splash ready onDone={onDone} steps={STEPS} />);
      expect(screen.getByTestId(SplashTestId.Root)).toHaveAttribute("data-phase", "exit");
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(onDone).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("renders a custom wordmark and footer", () => {
    render(<Splash footer="zibby os v0.9" ready={false} wordmark="ACME" />);
    expect(screen.getByTestId(SplashTestId.Wordmark)).toHaveTextContent("ACME");
    expect(screen.getByTestId(SplashTestId.Footer)).toHaveTextContent("zibby os v0.9");
  });

  it("renders as a status role with an accessible label", () => {
    render(<Splash ready={false} status="Booting" />);
    const el = screen.getByTestId(SplashTestId.Root);
    expect(el).toHaveRole("status");
    expect(el).toHaveAccessibleName("Booting");
  });
});
