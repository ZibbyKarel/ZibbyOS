import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionRibbon, ConnectionRibbonTestId } from "./ConnectionRibbon";

describe("ConnectionRibbon", () => {
  it("marks the current level and lets the others navigate", () => {
    const onSelect = vi.fn();
    render(
      <ConnectionRibbon
        items={[
          { kind: "Company", label: "Acme", icon: "building", onSelect },
          { kind: "Project", label: "api", icon: "branch", current: true },
        ]}
      />,
    );
    const items = screen.getAllByTestId(ConnectionRibbonTestId.Item);
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveAttribute("aria-current", "page");
    fireEvent.click(items[0] as HTMLElement);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
