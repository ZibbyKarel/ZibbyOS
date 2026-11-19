import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { StepSlider } from "./StepSlider";

const meta: Meta<typeof StepSlider> = {
  title: "DesignSystem/StepSlider",
  component: StepSlider,
};
export default meta;

type Story = StoryObj<typeof StepSlider>;

const steps = [
  { value: "manual", label: "Manual" },
  { value: "semi", label: "Semi-auto" },
  { value: "auto", label: "Auto" },
];

function Controlled({ initial }: { initial: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <div className="max-w-xs p-8">
      <StepSlider
        ariaLabel="Autonomy level"
        mixedLabel="Mixed"
        onChange={setValue}
        steps={steps}
        value={value}
      />
    </div>
  );
}

export const Overview: Story = { render: () => <Controlled initial="semi" /> };
export const Mixed: Story = { render: () => <Controlled initial={null} /> };
