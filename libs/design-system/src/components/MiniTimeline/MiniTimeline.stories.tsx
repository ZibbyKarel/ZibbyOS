import type { Meta, StoryObj } from "@storybook/react";
import { MiniTimeline } from "./MiniTimeline";

const meta: Meta<typeof MiniTimeline> = {
  title: "DesignSystem/MiniTimeline",
  component: MiniTimeline,
  args: {
    last: true,
    next: true,
    now: 30,
    leftLabel: "naposledy před 9 h",
    nowLabel: "teď",
    rightLabel: "příští za 21 h",
  },
};
export default meta;
export const Default: StoryObj<typeof MiniTimeline> = {};
export const Fires: StoryObj<typeof MiniTimeline> = {
  args: { now: undefined, last: false, next: false, fires: [8, 40, 70, 96] },
};
