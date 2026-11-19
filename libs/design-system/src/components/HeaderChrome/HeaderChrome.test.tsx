import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { Icon } from "../Icon/Icon";
import {
  HeaderChromeTestId,
  HeaderIconButton,
  HeaderModeButton,
  HeaderModeGroup,
  HeaderNewButton,
} from "./HeaderChrome";

describe("HeaderNewButton", () => {
  it("renders the label and fires onClick", () => {
    const onClick = vi.fn();
    render(<HeaderNewButton aria-haspopup="menu" label="New" onClick={onClick} />);
    const btn = screen.getByTestId(HeaderChromeTestId.NewButton);
    expect(btn).toHaveTextContent("New");
    expect(btn).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is icon-only without a label", () => {
    render(<HeaderNewButton aria-label="Create" />);
    const btn = screen.getByTestId(HeaderChromeTestId.NewButton);
    expect(btn).toHaveAccessibleName("Create");
    expect(btn).toHaveTextContent("");
  });
});

describe("HeaderModeGroup", () => {
  it("is a labelled group", () => {
    render(
      <HeaderModeGroup ariaLabel="Operating mode">
        <HeaderModeButton live pressed aria-label="Autopilot on" label="Autopilot" />
        <HeaderModeButton icon="compass" label="Approve" />
      </HeaderModeGroup>,
    );
    const group = screen.getByTestId(HeaderChromeTestId.ModeGroup);
    expect(group).toHaveRole("group");
    expect(group).toHaveAccessibleName("Operating mode");
    const [first] = screen.getAllByTestId(HeaderChromeTestId.ModeButton);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(HeaderChromeTestId.ModeLiveDot)).toBeInTheDocument();
  });

  it("is not active by default", () => {
    render(
      <HeaderModeGroup ariaLabel="Operating mode">
        <HeaderModeButton label="Approve" />
      </HeaderModeGroup>,
    );
    expect(screen.getByTestId(HeaderChromeTestId.ModeGroup)).not.toHaveAttribute("data-active");
  });
});

describe("HeaderIconButton", () => {
  it("renders a badge in ink by default and amber for attention", () => {
    const { rerender } = render(
      <HeaderIconButton aria-label="Notifications" badge={5}>
        <Icon name="bell" />
      </HeaderIconButton>,
    );
    const badge = screen.getByTestId(HeaderChromeTestId.IconButtonBadge);
    expect(badge).toHaveTextContent("5");
    expect(badge.className).toContain("bg-ink");
    rerender(
      <HeaderIconButton aria-label="Notifications" badge={5} badgeTone="attention">
        <Icon name="bell" />
      </HeaderIconButton>,
    );
    expect(screen.getByTestId(HeaderChromeTestId.IconButtonBadge).className).toContain("bg-accent");
  });

  it("has no badge by default", () => {
    render(
      <HeaderIconButton aria-label="Settings">
        <Icon name="gear" />
      </HeaderIconButton>,
    );
    expect(screen.queryByTestId(HeaderChromeTestId.IconButtonBadge)).toBeNull();
  });
});
