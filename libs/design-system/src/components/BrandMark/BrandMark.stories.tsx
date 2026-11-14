import type { Meta, StoryObj } from "@storybook/react";
import { BrandMark } from "./BrandMark";

const meta: Meta<typeof BrandMark> = {
  title: "DesignSystem/BrandMark",
  component: BrandMark,
  argTypes: {
    size: { control: "select", options: [16, 24, 32, 48, 64, 92, 116] },
    state: { control: "inline-radio", options: ["idle", "working", "blocked"] },
  },
};
export default meta;

type Story = StoryObj<typeof BrandMark>;

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-8 text-ink">
      <div className="flex items-end gap-6">
        <BrandMark size={16} />
        <BrandMark size={24} />
        <BrandMark size={32} />
        <BrandMark size={48} />
        <BrandMark size={64} />
        <BrandMark size={116} />
      </div>
      <div className="flex items-end gap-8">
        <BrandMark live size={64} state="idle" />
        <BrandMark live size={64} state="working" />
        <BrandMark live size={64} state="blocked" />
        <BrandMark intro size={92} />
      </div>
    </div>
  ),
};

export const Playground: Story = {
  args: { size: 64, state: "blocked", live: true, intro: false, label: "ZibbyOS" },
  render: (args) => (
    <div className="text-ink">
      <BrandMark {...args} />
    </div>
  ),
};
