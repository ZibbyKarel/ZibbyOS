import type { Meta, StoryObj } from "@storybook/react";
import { KpiTile } from "./KpiTile";

const meta: Meta<typeof KpiTile> = {
  title: "DesignSystem/KpiTile",
  component: KpiTile,
  decorators: [
    (Story) => (
      <div className="w-[200px]">
        <Story />
      </div>
    ),
  ],
  args: { label: "Runs · 30 days", value: "91", trend: [2, 3, 3, 4, 2, 5, 4, 6, 5, 7, 6, 8] },
};
export default meta;

type Story = StoryObj<typeof KpiTile>;

export const Default: Story = {};
export const WithUnit: Story = {
  args: { label: "Success rate", value: "86", unit: "%", trendTone: "ok" },
};
export const NoTrend: Story = { args: { trend: undefined } };
