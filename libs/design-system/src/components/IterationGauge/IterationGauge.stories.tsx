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

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <IterationGauge
        ariaLabel="4 of 8 iterations used"
        caption="4 left before it parks"
        label="Iterations"
        max={8}
        ofLabel="of 8"
        used={4}
      />
      <IterationGauge
        ariaLabel="7 of 8 iterations used"
        caption="1 left before it parks"
        label="Iterations"
        max={8}
        ofLabel="of 8"
        used={7}
      />
      <IterationGauge
        ariaLabel="3 of 3 projects done"
        caption="all done"
        hot={false}
        label="Projects"
        max={3}
        ofLabel="of 3"
        used={3}
      />
      <IterationGauge
        ariaLabel="0 of 8 iterations used"
        caption="8 left"
        label="Iterations"
        max={8}
        ofLabel="of 8"
        used={0}
      />
    </div>
  ),
};

export const Playground: Story = {};
