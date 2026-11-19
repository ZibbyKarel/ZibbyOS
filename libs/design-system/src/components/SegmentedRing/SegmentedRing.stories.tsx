import type { Meta, StoryObj } from "@storybook/react";
import { SegmentedRing } from "./SegmentedRing";

const meta: Meta<typeof SegmentedRing> = {
  title: "DesignSystem/SegmentedRing",
  component: SegmentedRing,
  args: { used: 7, max: 12, tone: "working", caption: "z 12 iterací", ariaLabel: "7 z 12 iterací" },
};
export default meta;
export const Working: StoryObj<typeof SegmentedRing> = {};
export const Parked: StoryObj<typeof SegmentedRing> = {
  args: { tone: "blocked", used: 9, max: 10 },
};
