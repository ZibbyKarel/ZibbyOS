import type { Agent } from "@zibby/contracts";
import { EngineBadgeTestId, IconTileTestId } from "@zibby/design-system";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../../../test/render";
import { AgentCard } from "./AgentCard";

const baseAgent: Agent = {
  id: "architect",
  name: "Architekt",
  description: "Plans the work",
  glyph: "compass",
  model: "opus",
  thinking: "high",
  tools: [],
  instructions: "x",
};

describe("AgentCard", () => {
  it("renders name and description", () => {
    render(<AgentCard agent={baseAgent} />);
    expect(screen.getByText("Architekt")).toBeInTheDocument();
    expect(screen.getByText("Plans the work")).toBeInTheDocument();
  });

  it("calls onClick with the agent", () => {
    const onClick = vi.fn();
    render(<AgentCard agent={baseAgent} onClick={onClick} />);
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledWith(baseAgent);
  });

  it("renders the agent avatar over the glyph", () => {
    render(<AgentCard agent={{ ...baseAgent, avatar: "/avatars/architect.png" }} />);
    expect(screen.getByTestId(IconTileTestId.Image)).toHaveAttribute(
      "src",
      "/avatars/architect.png",
    );
  });

  it("badges the avatar with the agent's engine override", () => {
    render(<AgentCard agent={{ ...baseAgent, engine: "claude" }} />);
    const badge = screen.getByTestId(EngineBadgeTestId.Badge);
    expect(badge).toHaveAttribute("data-engine", "claude");
    expect(badge).toHaveAccessibleName("Claude Code");
  });

  it("shows the OpenAI mark for an opencode agent on an openai/ model", () => {
    render(<AgentCard agent={{ ...baseAgent, engine: "opencode", engineModel: "openai/gpt-5" }} />);
    expect(screen.getByTestId(EngineBadgeTestId.Badge)).toHaveAccessibleName("OpenAI");
  });
});
