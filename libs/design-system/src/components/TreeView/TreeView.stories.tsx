import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { type TreeNode, TreeView } from "./TreeView";

const meta: Meta<typeof TreeView> = {
  title: "DesignSystem/TreeView",
  component: TreeView,
};
export default meta;

type Story = StoryObj<typeof TreeView>;

const nodes: TreeNode[] = [
  {
    id: "vault",
    label: "Vault",
    children: [
      { id: "memory", label: "Memory", children: [{ id: "n1", label: "North Star" }] },
      { id: "n2", label: "Daily log" },
    ],
  },
  { id: "kb", label: "Team KB", children: [{ id: "n3", label: "Onboarding" }] },
];

export const Overview: Story = {
  render: () => {
    const [open, setOpen] = useState<Set<string>>(new Set(["vault"]));
    const [sel, setSel] = useState<string | null>("n2");
    return (
      <div className="w-64">
        <TreeView
          expandedIds={open}
          label="Notes"
          nodes={nodes}
          onSelect={setSel}
          onToggle={(id) =>
            setOpen((p) => {
              const n = new Set(p);
              if (!n.delete(id)) n.add(id);
              return n;
            })
          }
          selectedId={sel}
        />
      </div>
    );
  },
};
