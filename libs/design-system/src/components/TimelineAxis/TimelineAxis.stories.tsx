import type { Meta, StoryObj } from "@storybook/react";
import { TimelineAxis } from "./TimelineAxis";

const meta: Meta<typeof TimelineAxis> = {
  title: "DesignSystem/TimelineAxis",
  component: TimelineAxis,
  args: {
    label: "Next 24 hours: 3 starts around 03:00",
    ticks: [
      { at: 3.17 / 24, label: "00" },
      { at: 9.17 / 24, label: "06" },
      { at: 15.17 / 24, label: "12" },
      { at: 21.17 / 24, label: "18" },
    ],
    markers: [
      { at: 6.17 / 24, label: "03:00" },
      { at: 6.67 / 24, label: "03:30", error: true },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TimelineAxis>;

export const Default: Story = {};
