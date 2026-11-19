import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegistryRow, RegistryRowTestId } from "./RegistryRow";

describe("RegistryRow", () => {
  it("renders the slots and opens via the cover", () => {
    const onOpen = vi.fn();
    render(
      <ul>
        <RegistryRow aside="aside" lead="lead" onOpen={onOpen} openLabel="Open" trailing="trail">
          main
        </RegistryRow>
      </ul>,
    );
    expect(screen.getByTestId(RegistryRowTestId.Lead)).toHaveTextContent("lead");
    expect(screen.getByTestId(RegistryRowTestId.Main)).toHaveTextContent("main");
    expect(screen.getByTestId(RegistryRowTestId.Aside)).toHaveTextContent("aside");
    expect(screen.getByTestId(RegistryRowTestId.Trailing)).toHaveTextContent("trail");
    fireEvent.click(screen.getByTestId(RegistryRowTestId.Open));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
