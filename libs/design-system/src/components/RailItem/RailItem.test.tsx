import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RailItem, RailItemTestId } from "./RailItem";

describe("RailItem", () => {
  it("renders title, leading and meta", () => {
    render(<RailItem leading="L" meta="RUNNING · 01:02" title="1 · Plan" />);
    expect(screen.getByTestId(RailItemTestId.Title)).toHaveTextContent("1 · Plan");
    expect(screen.getByTestId(RailItemTestId.Leading)).toHaveTextContent("L");
    expect(screen.getByTestId(RailItemTestId.Meta)).toHaveTextContent("RUNNING");
  });

  it("marks the selected row with aria-current", () => {
    render(<RailItem selected title="x" />);
    expect(screen.getByTestId(RailItemTestId.Root)).toHaveAttribute("aria-current", "true");
  });

  it("has no aria-current when not selected", () => {
    render(<RailItem title="x" />);
    expect(screen.getByTestId(RailItemTestId.Root)).not.toHaveAttribute("aria-current");
  });

  it("running row gets the run-coloured border and data-running", () => {
    render(<RailItem running title="x" />);
    const root = screen.getByTestId(RailItemTestId.Root);
    expect(root).toHaveAttribute("data-running", "true");
    expect(root.className).toContain("border-run");
  });

  it("non-running row has no data-running or run border", () => {
    render(<RailItem selected title="x" />);
    const root = screen.getByTestId(RailItemTestId.Root);
    expect(root).not.toHaveAttribute("data-running");
    expect(root.className).not.toContain("border-run");
  });

  it("omits the meta row without meta", () => {
    render(<RailItem title="x" />);
    expect(screen.queryByTestId(RailItemTestId.Meta)).toBeNull();
  });

  it("fires onClick and forwards ref", () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(<RailItem onClick={onClick} ref={ref} title="x" />);
    fireEvent.click(screen.getByTestId(RailItemTestId.Root));
    expect(onClick).toHaveBeenCalledOnce();
    expect(ref.current).toBe(screen.getByTestId(RailItemTestId.Root));
  });
  it("timeline: past shows a check marker and mutes the title", () => {
    render(<RailItem leading="L" tense="past" title="Plan" />);
    const marker = screen.getByTestId(RailItemTestId.Marker);
    expect(marker).toHaveAttribute("data-tense", "past");
    expect(screen.getByTestId(RailItemTestId.Leading)).not.toHaveTextContent("L");
    expect(screen.getByTestId(RailItemTestId.Title).className).toContain("text-foreground-dim");
  });

  it("timeline: present marker takes the state tone and pulses unless motion is reduced", () => {
    render(<RailItem markerTone="blocked" tense="present" title="Publish" />);
    const marker = screen.getByTestId(RailItemTestId.Marker);
    expect(marker).toHaveAttribute("data-tone", "blocked");
    expect(marker.className).toContain("animate-zb-pulse");
    expect(marker.className).toContain("motion-reduce:animate-none");
    expect(screen.getByTestId(RailItemTestId.Root).className).toContain("bg-elevated");
  });

  it("timeline: future marker and connector are dashed", () => {
    render(<RailItem tense="future" title="QA" />);
    expect(screen.getByTestId(RailItemTestId.Marker).className).toContain("border-dashed");
    expect(screen.getByTestId(RailItemTestId.Leading).className).toContain("before:border-dashed");
  });

  it("renders aside and detail slots only when given", () => {
    const { rerender } = render(<RailItem title="x" />);
    expect(screen.queryByTestId(RailItemTestId.Aside)).toBeNull();
    expect(screen.queryByTestId(RailItemTestId.Detail)).toBeNull();
    rerender(
      <RailItem aside="03:12" title="x">
        <span>checkpoint · abc1234</span>
      </RailItem>,
    );
    expect(screen.getByTestId(RailItemTestId.Aside)).toHaveTextContent("03:12");
    expect(screen.getByTestId(RailItemTestId.Detail)).toHaveTextContent("checkpoint · abc1234");
  });
});
