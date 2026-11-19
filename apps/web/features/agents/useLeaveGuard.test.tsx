import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLeaveGuard } from "./useLeaveGuard";

describe("useLeaveGuard", () => {
  it("parks a same-origin link click while active", () => {
    const { result } = renderHook(() => useLeaveGuard(true));
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    render(<a href="/workforce/agents">back</a>);
    fireEvent.click(screen.getByText("back"));
    expect(result.current.pending).toBe("/workforce/agents");
  });

  it("lets clicks through when inactive or external", () => {
    const off = renderHook(() => useLeaveGuard(false));
    const on = renderHook(() => useLeaveGuard(true));
    render(
      <>
        <a href="/x">in</a>
        <a href="https://example.com/y">out</a>
      </>,
    );
    fireEvent.click(screen.getByText("out"));
    expect(on.result.current.pending).toBeNull();
    expect(off.result.current.pending).toBeNull();
  });
});
