import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbySuggestions, ZibbySuggestionsTestId } from "./ZibbySuggestions";

describe("ZibbySuggestions", () => {
  it("renders lead and pills, calls onSelect", async () => {
    const user = userEvent.setup();
    const a = vi.fn();
    const b = vi.fn();
    render(
      <ZibbySuggestions
        items={[
          { label: "Co je nového?", onSelect: a },
          { label: "log.txt", onSelect: b, icon: "paperclip", lead: "nebo přilož:" },
        ]}
        label="Návrhy"
        lead="Zkus říct:"
      />,
    );
    const root = screen.getByTestId(ZibbySuggestionsTestId.Root);
    expect(root).toHaveRole("group");
    expect(root).toHaveAccessibleName("Návrhy");
    const leads = screen.getAllByTestId(ZibbySuggestionsTestId.Lead);
    expect(leads).toHaveLength(2);
    expect(leads[0]).toHaveTextContent("Zkus říct:");
    const items = screen.getAllByTestId(ZibbySuggestionsTestId.Item);
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveAttribute("type", "button");
    await user.click(items[0]!);
    await user.click(items[1]!);
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
});
