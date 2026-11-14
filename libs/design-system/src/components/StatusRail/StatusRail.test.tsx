import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import {
  StateDot,
  StatusRail,
  StatusRailItem,
  StatusRailNow,
  StatusRailPark,
  StatusRailTestId,
} from "./StatusRail";

describe("StatusRail", () => {
  it("renders an item with dot, title, sub and time; a button with data-rk when clickable", async () => {
    const onClick = vi.fn();
    render(
      <StatusRail>
        <StatusRailItem
          selected
          onClick={onClick}
          rowKey="w:1"
          sub="workflow"
          time="2h"
          title="Fix CI"
          tone="done"
          toneLabel="Done"
        />
      </StatusRail>,
    );
    const item = screen.getByTestId(StatusRailTestId.Item);
    expect(item).toHaveRole("button");
    expect(item).toHaveAttribute("data-rk", "w:1");
    expect(item).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(StatusRailTestId.Title)).toHaveTextContent("Fix CI");
    expect(screen.getByTestId(StatusRailTestId.Sub)).toHaveTextContent("workflow");
    expect(screen.getByTestId(StatusRailTestId.Time)).toHaveTextContent("2h");
    expect(screen.getByTestId(StatusRailTestId.Dot)).toHaveAccessibleName("Done");
    expect(screen.getByTestId(StatusRailTestId.Dot)).toHaveAttribute("data-state", "done");
    await userEvent.click(item);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is static without onClick", () => {
    render(<StatusRailItem title="x" tone="idle" />);
    expect(screen.getByTestId(StatusRailTestId.Item)).not.toHaveRole("button");
  });

  it("decorative dot without a label", () => {
    render(<StateDot tone="working" />);
    expect(screen.getByTestId(StatusRailTestId.Dot)).toHaveAttribute("aria-hidden", "true");
  });

  it("now line shows label and aside", () => {
    render(<StatusRailNow aside="in 11 min" label="Nothing running" />);
    expect(screen.getByTestId(StatusRailTestId.Now)).toHaveTextContent("Nothing running");
    expect(screen.getByTestId(StatusRailTestId.NowAside)).toHaveTextContent("in 11 min");
  });

  it("park block: clickable head and actions as siblings", async () => {
    const onClick = vi.fn();
    const onAct = vi.fn();
    render(
      <StatusRailPark
        actions={<button onClick={onAct}>Approve</button>}
        onClick={onClick}
        rowKey="w:2"
        title="Rebase"
        why="Conflict"
      />,
    );
    expect(screen.getByTestId(StatusRailTestId.Item)).toHaveAttribute("data-rk", "w:2");
    expect(screen.getByTestId(StatusRailTestId.ParkWhy)).toHaveTextContent("Conflict");
    await userEvent.click(screen.getByText("Approve"));
    expect(onAct).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByTestId(StatusRailTestId.ParkActions)).not.toContainElement(
      screen.getByTestId(StatusRailTestId.Title),
    );
  });
});
