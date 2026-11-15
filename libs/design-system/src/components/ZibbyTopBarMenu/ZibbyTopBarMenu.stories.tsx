import type { Meta, StoryObj } from "@storybook/react";
import { ZibbyTopBarMenu } from "./ZibbyTopBarMenu";

const meta: Meta<typeof ZibbyTopBarMenu> = {
  title: "DesignSystem/ZibbyTopBarMenu",
  component: ZibbyTopBarMenu,
};
export default meta;

type Story = StoryObj<typeof ZibbyTopBarMenu>;

const items = [
  { id: "rename", label: "Rename", icon: "pen" as const, onSelect: () => undefined },
  {
    id: "clear",
    label: "Clear and start over",
    icon: "retry" as const,
    disabled: true,
    onSelect: () => undefined,
  },
  {
    id: "delete",
    label: "Delete conversation",
    icon: "trash" as const,
    danger: true,
    onSelect: () => undefined,
  },
];

export const Overview: Story = {
  render: () => (
    <div className="flex h-[200px] w-[300px] justify-end">
      <ZibbyTopBarMenu items={items} label="More actions" />
    </div>
  ),
};

export const Playground: Story = {
  args: { items, label: "More actions", icon: "dots" },
};
