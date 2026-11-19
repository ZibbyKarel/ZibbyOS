import type { Meta, StoryObj } from "@storybook/react";
import { SegmentedBar } from "./SegmentedBar";

const meta: Meta<typeof SegmentedBar> = {
  title: "DesignSystem/SegmentedBar",
  component: SegmentedBar,
  args: {
    ariaLabel: "ratio",
    segments: [
      { id: "a", value: 2, tone: "run" },
      { id: "b", value: 40, tone: "ok" },
      { id: "c", value: 3, tone: "bad" },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof SegmentedBar> = {};
