import type { Meta, StoryObj } from "@storybook/react";
import { Meter } from "./Meter";

const meta: Meta<typeof Meter> = {
  title: "DesignSystem/Meter",
  component: Meter,
  args: { label: "Weekly limit", value: "62 %", pct: 62, tone: "ok" },
  argTypes: { tone: { control: "select", options: ["ok", "hot", "bad"] } },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Meter>;

export const Ok: Story = {};
export const Hot: Story = {
  args: { pct: 91, value: "91 %", tone: "hot", note: "Runs out in 2h 10m" },
};
export const Exhausted: Story = { args: { pct: 100, value: "100 %", tone: "bad" } };
