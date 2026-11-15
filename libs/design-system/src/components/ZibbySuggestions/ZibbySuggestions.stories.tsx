import type { Meta, StoryObj } from "@storybook/react";
import { ZibbySuggestions } from "./ZibbySuggestions";

const meta: Meta<typeof ZibbySuggestions> = {
  title: "DesignSystem/ZibbySuggestions",
  component: ZibbySuggestions,
};
export default meta;

type Story = StoryObj<typeof ZibbySuggestions>;

const items = [
  { label: "„Co je nového?“", onSelect: () => {} },
  {
    label: "pipeline-8815.log",
    onSelect: () => {},
    icon: "paperclip" as const,
    lead: "nebo přilož:",
  },
];

export const Overview: Story = {
  render: () => (
    <div className="flex w-[640px] flex-col gap-6">
      <ZibbySuggestions items={items} lead="Zkus říct:" />
      <div className="w-[260px]">
        <ZibbySuggestions items={items} lead="Zkus říct:" />
      </div>
    </div>
  ),
};

export const Playground: Story = {
  args: { lead: "Zkus říct:", items },
  render: (args) => (
    <div className="w-[640px]">
      <ZibbySuggestions {...args} />
    </div>
  ),
};
