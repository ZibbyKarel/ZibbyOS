import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectionStrip, ConnectionStripTestId } from "./ConnectionStrip";

describe("ConnectionStrip", () => {
  it("renders the kicker, summary, legend and tiles", () => {
    render(
      <ConnectionStrip
        inheritedLabel="inherited"
        label="Connections"
        ownLabel="own"
        summary="4 connected"
      >
        <div>tile</div>
      </ConnectionStrip>,
    );
    const root = screen.getByTestId(ConnectionStripTestId.Root);
    expect(root).toHaveTextContent("Connections");
    expect(root).toHaveTextContent("4 connected");
    expect(root).toHaveTextContent("own");
    expect(screen.getByTestId(ConnectionStripTestId.Grid)).toHaveTextContent("tile");
  });
});
