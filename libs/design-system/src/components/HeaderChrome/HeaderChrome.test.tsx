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
  HeaderStatus,
  UsageRing,
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

describe("HeaderStatus", () => {
  it("shows count, rings and update badge", () => {
    render(
      <HeaderStatus
        aria-label="3 agents working"
        count={3}
        rings={<UsageRing value={40} />}
        update={<Icon name="upgrade" />}
      />,
    );
    expect(screen.getByTestId(HeaderChromeTestId.Status)).toHaveAccessibleName("3 agents working");
    expect(screen.getByTestId(HeaderChromeTestId.StatusCount)).toHaveTextContent("3");
    expect(screen.getByTestId(HeaderChromeTestId.StatusRings)).toBeInTheDocument();
    expect(screen.getByTestId(HeaderChromeTestId.StatusUpdate)).toBeInTheDocument();
  });

  it("omits rings and update when not given, and flags attention", () => {
    render(<HeaderStatus attention aria-label="x" count={1} state="blocked" />);
    expect(screen.queryByTestId(HeaderChromeTestId.StatusRings)).toBeNull();
    expect(screen.queryByTestId(HeaderChromeTestId.StatusUpdate)).toBeNull();
    expect(screen.getByTestId(HeaderChromeTestId.Status)).toHaveAttribute("data-attention", "true");
    expect(screen.getByTestId(HeaderChromeTestId.StatusCount).className).toContain("font-semibold");
  });
});

describe("HeaderModeGroup", () => {
  it("is a labelled group and marks active", () => {
    render(
      <HeaderModeGroup active ariaLabel="Operating mode">
        <HeaderModeButton live pressed aria-label="Autopilot on" label="Autopilot" />
        <HeaderModeButton icon="compass" label="Approve" />
      </HeaderModeGroup>,
    );
    const group = screen.getByTestId(HeaderChromeTestId.ModeGroup);
    expect(group).toHaveRole("group");
    expect(group).toHaveAccessibleName("Operating mode");
    expect(group).toHaveAttribute("data-active", "true");
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

describe("UsageRing", () => {
  it("turns hot from the threshold up", () => {
    const { rerender } = render(<UsageRing value={79} />);
    expect(screen.getByTestId(HeaderChromeTestId.UsageRing)).not.toHaveAttribute("data-hot");
    rerender(<UsageRing value={80} />);
    expect(screen.getByTestId(HeaderChromeTestId.UsageRing)).toHaveAttribute("data-hot", "true");
  });

  it("is an accessible image only when labelled", () => {
    const { rerender } = render(<UsageRing value={10} />);
    expect(screen.getByTestId(HeaderChromeTestId.UsageRing)).toHaveAttribute("aria-hidden", "true");
    rerender(<UsageRing label="5-hour usage 10%" value={10} />);
    expect(screen.getByTestId(HeaderChromeTestId.UsageRing)).toHaveAccessibleName(
      "5-hour usage 10%",
    );
  });
});
