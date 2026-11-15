import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import {
  ZibbyHistoryPanelTestId as T,
  ZibbyHistoryPanel,
  type ZibbyHistoryPanelProps,
} from "./ZibbyHistoryPanel";

const groups = [
  {
    label: "Today",
    items: [
      {
        id: "a",
        title: "Fix CI on partner-cli",
        time: "14:32",
        snippet: "You: rebase it",
        active: true,
      },
      { id: "b", title: "Morning briefing", time: "08:10" },
    ],
  },
  { label: "Yesterday", items: [{ id: "c", title: "Release notes", time: "Tue" }] },
  { label: "Older", items: [] },
];

function setup(props: Partial<ZibbyHistoryPanelProps> = {}) {
  const fns = {
    onOpen: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onNew: vi.fn(),
    onClose: vi.fn(),
    onQueryChange: vi.fn(),
  };
  render(<ZibbyHistoryPanel groups={groups} query="" {...fns} {...props} />);
  return fns;
}

describe("ZibbyHistoryPanel", () => {
  it("renders header, count, groups and rows; skips empty groups", () => {
    setup({ count: 3, footer: "Saved automatically" });
    expect(screen.getByTestId(T.Title)).toHaveTextContent("Conversations");
    expect(screen.getByTestId(T.Count)).toHaveTextContent("3");
    expect(screen.getByTestId(`${T.Group}-0`)).toHaveRole("group");
    expect(screen.getByTestId(`${T.Group}-0`)).toHaveAccessibleName("Today");
    expect(screen.getByTestId(`${T.Group}-1`)).toHaveAccessibleName("Yesterday");
    expect(screen.queryByTestId(`${T.Group}-2`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`${T.RowTitle}-a`)).toHaveTextContent("Fix CI on partner-cli");
    expect(screen.getByTestId(`${T.RowTime}-a`)).toHaveTextContent("14:32");
    expect(screen.getByTestId(`${T.RowSnippet}-a`)).toHaveTextContent("You: rebase it");
    expect(screen.queryByTestId(`${T.RowSnippet}-b`)).not.toBeInTheDocument();
    expect(screen.getByTestId(T.Footer)).toHaveTextContent("Saved automatically");
  });

  it("marks only the active row with aria-current", () => {
    setup();
    expect(screen.getByTestId(`${T.RowButton}-a`)).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId(`${T.RowButton}-b`)).not.toHaveAttribute("aria-current");
  });

  it("shows the empty state", () => {
    setup({ groups: [{ label: "Today", items: [] }], emptyLabel: "Nothing found for “zz”" });
    expect(screen.getByTestId(T.Empty)).toHaveTextContent("Nothing found for “zz”");
    expect(screen.queryByTestId(`${T.Group}-0`)).not.toBeInTheDocument();
  });

  it("highlights the query in title and snippet", () => {
    setup({ query: "ci" });
    const marks = within(screen.getByTestId(`${T.RowTitle}-a`)).getAllByTestId(T.Mark);
    expect(marks[0]).toHaveTextContent("CI");
    expect(marks[0]?.tagName).toBe("MARK");
    setup({ query: "rebase" });
    expect(
      within(screen.getAllByTestId(`${T.RowSnippet}-a`)[1]!).getByTestId(T.Mark),
    ).toHaveTextContent("rebase");
  });

  it("does not choke on regex characters in the query", () => {
    setup({ query: "(" });
    expect(screen.getByTestId(`${T.RowTitle}-a`)).toBeInTheDocument();
  });

  it("opens a row and fires header buttons", async () => {
    const user = userEvent.setup();
    const fns = setup();
    await user.click(screen.getByTestId(`${T.RowButton}-b`));
    expect(fns.onOpen).toHaveBeenCalledWith("b");
    await user.click(screen.getByTestId(T.NewButton));
    expect(fns.onNew).toHaveBeenCalledOnce();
    expect(screen.getByTestId(T.CloseButton)).toHaveAccessibleName("Close history");
    await user.click(screen.getByTestId(T.CloseButton));
    expect(fns.onClose).toHaveBeenCalledOnce();
  });

  it("has a labelled search with a clear button only when non-empty", async () => {
    const user = userEvent.setup();
    const fns = setup();
    expect(screen.getByTestId(T.SearchInput)).toHaveAccessibleName("Search conversations");
    expect(screen.queryByTestId(T.SearchClear)).not.toBeInTheDocument();
    await user.type(screen.getByTestId(T.SearchInput), "x");
    expect(fns.onQueryChange).toHaveBeenCalledWith("x");
  });

  it("clears the query", async () => {
    const user = userEvent.setup();
    const fns = setup({ query: "abc" });
    expect(screen.getByTestId(T.SearchClear)).toHaveAccessibleName("Clear search");
    await user.click(screen.getByTestId(T.SearchClear));
    expect(fns.onQueryChange).toHaveBeenCalledWith("");
  });

  it("labels row actions from templates and deletes", async () => {
    const user = userEvent.setup();
    const fns = setup({
      renameLabel: (t) => `Přejmenovat „${t}“`,
      deleteLabel: (t) => `Smazat „${t}“`,
    });
    expect(screen.getByTestId(`${T.RenameButton}-b`)).toHaveAccessibleName(
      "Přejmenovat „Morning briefing“",
    );
    expect(screen.getByTestId(`${T.DeleteButton}-b`)).toHaveAccessibleName(
      "Smazat „Morning briefing“",
    );
    await user.click(screen.getByTestId(`${T.DeleteButton}-b`));
    expect(fns.onDelete).toHaveBeenCalledWith("b");
  });

  it("renames via the pencil: Enter commits, trimmed", async () => {
    const user = userEvent.setup();
    const fns = setup();
    await user.click(screen.getByTestId(`${T.RenameButton}-b`));
    const input = screen.getByTestId(`${T.RenameInput}-b`);
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleName("New conversation name");
    await user.clear(input);
    await user.type(input, "  Evening  {Enter}");
    expect(fns.onRename).toHaveBeenCalledOnce();
    expect(fns.onRename).toHaveBeenCalledWith("b", "Evening");
    expect(screen.queryByTestId(`${T.RenameInput}-b`)).not.toBeInTheDocument();
  });

  it("double-click starts rename; blur commits", async () => {
    const user = userEvent.setup();
    const fns = setup();
    await user.dblClick(screen.getByTestId(`${T.RowButton}-c`));
    await user.type(screen.getByTestId(`${T.RenameInput}-c`), " v2");
    await user.click(document.body);
    expect(fns.onRename).toHaveBeenCalledWith("c", "Release notes v2");
  });

  it("Escape cancels rename without propagating; unchanged/empty are no-ops", async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") outer();
    };
    document.addEventListener("keydown", listener);
    const fns = setup();
    await user.click(screen.getByTestId(`${T.RenameButton}-b`));
    await user.type(screen.getByTestId(`${T.RenameInput}-b`), "zz{Escape}");
    expect(fns.onRename).not.toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
    await user.click(screen.getByTestId(`${T.RenameButton}-b`));
    await user.type(screen.getByTestId(`${T.RenameInput}-b`), "{Enter}");
    await user.click(screen.getByTestId(`${T.RenameButton}-b`));
    await user.clear(screen.getByTestId(`${T.RenameInput}-b`));
    await user.type(screen.getByTestId(`${T.RenameInput}-b`), "{Enter}");
    expect(fns.onRename).not.toHaveBeenCalled();
    document.removeEventListener("keydown", listener);
  });

  it("supports controlled renamingId", () => {
    setup({ renamingId: "a" });
    expect(screen.getByTestId(`${T.RenameInput}-a`)).toHaveValue("Fix CI on partner-cli");
  });

  it("moves between rows with arrow keys and is Tab-reachable", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId(T.SearchInput));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId(`${T.RowButton}-a`)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId(`${T.RowButton}-b`)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId(`${T.RowButton}-c`)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId(`${T.RowButton}-c`)).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByTestId(`${T.RowButton}-a`)).toHaveFocus();
    // Row actions are real buttons in the tab order (revealed by focus-within).
    await user.tab();
    expect(screen.getByTestId(`${T.RenameButton}-a`)).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId(`${T.DeleteButton}-a`)).toHaveFocus();
  });

  it("works with uncontrolled query host", async () => {
    const user = userEvent.setup();
    function Host() {
      const [q, setQ] = useState("");
      return <ZibbyHistoryPanel groups={groups} onOpen={vi.fn()} onQueryChange={setQ} query={q} />;
    }
    render(<Host />);
    await user.type(screen.getByTestId(T.SearchInput), "rel");
    expect(within(screen.getByTestId(`${T.RowTitle}-c`)).getByTestId(T.Mark)).toHaveTextContent(
      "Rel",
    );
  });
});
