import type { Meta, StoryObj } from "@storybook/react";
import { BudgetGauge } from "./BudgetGauge";

const meta: Meta<typeof BudgetGauge> = {
  title: "DesignSystem/BudgetGauge",
  component: BudgetGauge,
  args: {
    pct: 62,
    caption: "Budget · November",
    value: "$1 240",
    of: "/ $2 000",
    rows: [{ label: "Runs", value: "318 / 500", pct: 64 }],
  },
};
export default meta;
export const Default: StoryObj<typeof BudgetGauge> = {};
export const NearCap: StoryObj<typeof BudgetGauge> = { args: { pct: 93 } };
