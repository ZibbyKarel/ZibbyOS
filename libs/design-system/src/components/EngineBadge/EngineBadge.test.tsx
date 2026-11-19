import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { EngineBadge, EngineBadgeTestId, EngineGlyph } from "./EngineBadge";

describe("EngineBadge", () => {
  it("pins the engine mark with its default accessible name", () => {
    render(
      <EngineBadge engine="claude">
        <span>avatar</span>
      </EngineBadge>,
    );
    const badge = screen.getByTestId(EngineBadgeTestId.Badge);
    expect(badge).toHaveRole("img");
    expect(badge).toHaveAccessibleName("Claude Code");
    expect(badge).toHaveAttribute("title", "Claude Code");
    expect(badge).toHaveAttribute("data-engine", "claude");
    expect(screen.getByText("avatar")).toBeInTheDocument();
  });

  it("uses the caller's label", () => {
    render(
      <EngineBadge engine="openai" label="OpenAI (gpt-5)">
        <span>avatar</span>
      </EngineBadge>,
    );
    expect(screen.getByTestId(EngineBadgeTestId.Badge)).toHaveAccessibleName("OpenAI (gpt-5)");
  });

  it("stacks several engines under one label listing all of them", () => {
    render(
      <EngineBadge engines={["claude", "opencode"]}>
        <span>avatar</span>
      </EngineBadge>,
    );
    const badge = screen.getByTestId(EngineBadgeTestId.Badge);
    expect(badge).toHaveAccessibleName("Claude Code, OpenCode");
    expect(badge).toHaveAttribute("data-engine", "claude opencode");
    expect(screen.getAllByTestId(EngineBadgeTestId.Mark)).toHaveLength(2);
  });

  it("renders only the children without an engine", () => {
    render(
      <EngineBadge>
        <span>avatar</span>
      </EngineBadge>,
    );
    expect(screen.getByText("avatar")).toBeInTheDocument();
    expect(screen.queryByTestId(EngineBadgeTestId.Root)).toBeNull();
    expect(screen.queryByTestId(EngineBadgeTestId.Badge)).toBeNull();
  });

  it("shows the BlueCode icon", () => {
    render(
      <EngineBadge engine="bluecode">
        <span>avatar</span>
      </EngineBadge>,
    );
    const badge = screen.getByTestId(EngineBadgeTestId.Badge);
    expect(badge).toHaveAccessibleName("BlueCode");
    expect(badge.querySelector("[data-icon='bluecode']")).not.toBeNull();
  });
});

describe("EngineGlyph", () => {
  it("renders the brand icon of a known engine and the text of an unknown one", () => {
    const { container } = render(
      <>
        <EngineGlyph engine="openai" />
        <EngineGlyph engine="XY" />
      </>,
    );
    expect(container.querySelector("[data-icon='openai']")).not.toBeNull();
    expect(container).toHaveTextContent("XY");
  });
});
