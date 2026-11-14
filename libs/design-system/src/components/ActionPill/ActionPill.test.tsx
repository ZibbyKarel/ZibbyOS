import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ActionPill, ActionPillAdd, ActionPillTestId } from "./ActionPill";

describe("ActionPill", () => {
  it("runs from the lead and opens from the label, independently", async () => {
    const onLead = vi.fn();
    const onOpen = vi.fn();
    render(
      <ActionPill
        label="Deploy"
        leadLabel="Run Deploy"
        onLead={onLead}
        onOpen={onOpen}
        rowKey="w:1"
        sub="agent"
      />,
    );
    expect(screen.getByTestId(ActionPillTestId.Root)).toHaveAttribute("data-rk", "w:1");
    await userEvent.click(screen.getByRole("button", { name: "Run Deploy" }));
    expect(onLead).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId(ActionPillTestId.Open));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.getByTestId(ActionPillTestId.Sub)).toHaveTextContent("agent");
  });

  it("disables the lead", () => {
    render(<ActionPill leadDisabled label="x" leadLabel="Run x" onLead={() => {}} />);
    expect(screen.getByTestId(ActionPillTestId.Lead)).toBeDisabled();
    expect(screen.queryByTestId(ActionPillTestId.Open)).toBeNull();
  });

  it("add pill fires onClick", async () => {
    const onClick = vi.fn();
    render(<ActionPillAdd onClick={onClick}>Add</ActionPillAdd>);
    await userEvent.click(screen.getByTestId(ActionPillTestId.Add));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
