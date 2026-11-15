import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTransientFlag } from "./useTransientFlag";

describe("useTransientFlag", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("switches on when triggered and off by itself after the duration", () => {
    const { result } = renderHook(() => useTransientFlag(1500));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(1499));
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(2));
    expect(result.current[0]).toBe(false);
  });

  it("re-triggering restarts the clock", () => {
    const { result } = renderHook(() => useTransientFlag(1000));
    act(() => result.current[1]());
    act(() => vi.advanceTimersByTime(800));
    act(() => result.current[1]());
    act(() => vi.advanceTimersByTime(800));
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current[0]).toBe(false);
  });
});
