import type { Meta, StoryObj } from "@storybook/react";
import { BudgetBars } from "./BudgetBars";

const meta: Meta<typeof BudgetBars> = {
  title: "DesignSystem/BudgetBars",
  component: BudgetBars,
  args: {
    items: [
      { id: "d", label: "Den", pct: 71 },
      { id: "w", label: "Týden", pct: 94 },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof BudgetBars> = {};
