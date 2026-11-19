import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type TreeNode, TreeView, TreeViewTestId } from "./TreeView";

const nodes: TreeNode[] = [
  {
    id: "src",
    label: "Vault",
    trailing: <span>2</span>,
    children: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
    ],
  },
  { id: "solo", label: "Solo" },
];

const row = (id: string) => screen.getByTestId(`${TreeViewTestId.Row}-${id}`);

function Harness({
  onSelect = vi.fn(),
  matchIds,
}: {
  onSelect?: (id: string) => void;
  matchIds?: Set<string>;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  return (
    <TreeView
      expandedIds={open}
      label="Notes"
      matchIds={matchIds}
      nodes={nodes}
      onSelect={onSelect}
      onToggle={(id) =>
        setOpen((p) => {
          const n = new Set(p);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        })
      }
      selectedId="a"
    />
  );
}

describe("TreeView", () => {
  it("is an ARIA tree and hides children of a collapsed branch", () => {
    render(<Harness />);
    expect(screen.getByTestId(TreeViewTestId.Root)).toHaveRole("tree");
    expect(screen.getByTestId(TreeViewTestId.Root)).toHaveAccessibleName("Notes");
    expect(row("src")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId(`${TreeViewTestId.Row}-a`)).toBeNull();
  });

  it("a branch click toggles, a leaf click selects", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await userEvent.click(row("src"));
    expect(row("src")).toHaveAttribute("aria-expanded", "true");
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(row("b"));
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(row("a")).toHaveAttribute("aria-selected", "true");
  });

  it("navigates with the keyboard", async () => {
    render(<Harness />);
    row("src").focus();
    fireEvent.keyDown(row("src"), { key: "ArrowRight" });
    expect(row("src")).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(row("src"), { key: "ArrowDown" });
    expect(row("a")).toHaveFocus();
    fireEvent.keyDown(row("a"), { key: "ArrowDown" });
    expect(row("b")).toHaveFocus();
    fireEvent.keyDown(row("b"), { key: "ArrowLeft" });
    expect(row("src")).toHaveFocus();
    fireEvent.keyDown(row("src"), { key: "ArrowLeft" });
    expect(row("src")).toHaveAttribute("aria-expanded", "false");
  });

  it("dims leaves outside matchIds", () => {
    render(<Harness matchIds={new Set(["solo"])} />);
    expect(row("solo").className).not.toContain("opacity-40");
  });
});
