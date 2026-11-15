import type { Meta, StoryObj } from "@storybook/react";
import { ZibbyThreadEmpty } from "./ZibbyThreadEmpty";

const meta: Meta<typeof ZibbyThreadEmpty> = {
  title: "DesignSystem/ZibbyThreadEmpty",
  component: ZibbyThreadEmpty,
};
export default meta;

type Story = StoryObj<typeof ZibbyThreadEmpty>;

const text =
  "Drž mezerník a mluv, nebo sem přetáhni soubory. Puštěním mezerníku se zpráva sama odešle a Zibby odpoví hlasem i textem.";

export const Overview: Story = {
  render: () => (
    <div className="flex h-[200px] w-[600px] flex-col">
      <ZibbyThreadEmpty>{text}</ZibbyThreadEmpty>
    </div>
  ),
};

export const Playground: Story = {
  args: { children: text },
  render: (args) => (
    <div className="flex h-[200px] w-[600px] flex-col">
      <ZibbyThreadEmpty {...args} />
    </div>
  ),
};
