import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMicLevel } from "./useMicLevel";

const trackStop = vi.fn();
const close = vi.fn(() => Promise.resolve());
let amplitude = 0;

class FakeAudioContext {
  resume = vi.fn();
  close = close;
  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  createAnalyser() {
    return {
      fftSize: 0,
      connect: vi.fn(),
      getFloatTimeDomainData: (buf: Float32Array) => buf.fill(amplitude),
    };
  }
}
const stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
const getUserMedia = vi.fn(() => Promise.resolve(stream));

beforeEach(() => {
  vi.useFakeTimers();
  amplitude = 0;
  trackStop.mockClear();
  close.mockClear();
  getUserMedia.mockClear();
  vi.stubGlobal("AudioContext", FakeAudioContext);
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useMicLevel", () => {
  it("opens its own stream, reports a level and releases everything", async () => {
    const { result, rerender, unmount } = renderHook(
      (p: { active: boolean }) => useMicLevel({ ...p, openOwn: true }),
      { initialProps: { active: true } },
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    amplitude = 0.1;
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current).toBeGreaterThan(0.3);
    expect(result.current).toBeLessThanOrEqual(1);
    rerender({ active: false });
    expect(result.current).toBe(0);
    expect(trackStop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    unmount();
  });

  it("reuses a given stream and never stops its tracks", async () => {
    const { unmount } = renderHook(() => useMicLevel({ active: true, stream }));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(getUserMedia).not.toHaveBeenCalled();
    unmount();
    expect(trackStop).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it("degrades to 0 when the mic is denied", async () => {
    getUserMedia.mockRejectedValueOnce(new Error("denied"));
    const { result } = renderHook(() => useMicLevel({ active: true, openOwn: true }));
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(result.current).toBe(0);
  });
});
