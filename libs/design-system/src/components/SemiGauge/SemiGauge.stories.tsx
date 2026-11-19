import type { Meta, StoryObj } from "@storybook/react";
import { SemiGauge } from "./SemiGauge";

const meta: Meta<typeof SemiGauge> = {
  title: "DesignSystem/SemiGauge",
  component: SemiGauge,
  args: { pct: 86, ariaLabel: "Budget", caption: "dnes $4.30 z $5" },
};
export default meta;
export const Default: StoryObj<typeof SemiGauge> = {};
