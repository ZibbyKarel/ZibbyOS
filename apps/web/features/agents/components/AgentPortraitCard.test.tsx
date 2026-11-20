import type { Agent } from "@zibby/contracts";
import { IconTestId, PortraitCardTestId } from "@zibby/design-system";
import { describe, expect, it } from "vitest";
import { renderWithProviders as render, screen, within } from "../../../test/render";
import { AgentPortraitCard } from "./AgentPortraitCard";

const agent: Agent = { id: "sec", instructions: "x", name: "sec", glyph: "shield" };

describe("AgentPortraitCard", () => {
  it("shows the agent's symbol icon in the avatar", () => {
    render(<AgentPortraitCard agent={agent} onOpen={() => {}} presence="idle" />);
    const avatar = screen.getByTestId(PortraitCardTestId.Avatar);
    // The engine badge in the avatar corner renders a second icon; the tile's own comes first.
    expect(within(avatar).getAllByTestId(IconTestId.Root)[0]).toHaveAttribute(
      "data-icon",
      "shield",
    );
  });
});
