import type { Meta, StoryObj } from "@storybook/react";
import { IterationGauge } from "./IterationGauge";

const meta: Meta<typeof IterationGauge> = {
  title: "DesignSystem/IterationGauge",
  component: IterationGauge,
  args: {
    used: 4,
    max: 8,
    ofLabel: "of 8",
    label: "Iterations",
    caption: "4 left before it parks",
    ariaLabel: "4 of 8 iterations used",
  },
};
export default meta;

type Story = StoryObj<typeof IterationGauge>;

export const Default: Story = {};
export const NearlyOut: Story = {
  args: { used: 7, caption: "1 left before it parks", ariaLabel: "7 of 8 iterations used" },
};
export const Empty: Story = {
  args: { used: 0, caption: "8 left", ariaLabel: "0 of 8 iterations used" },
};
