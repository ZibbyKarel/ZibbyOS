import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Stepper } from "./Stepper";

const meta: Meta<typeof Stepper> = {
  title: "DesignSystem/Stepper",
  component: Stepper,
};
export default meta;

type Story = StoryObj<typeof Stepper>;

export const Overview: Story = {
  render: () => {
    const [value, setValue] = useState(3);
    return <Stepper aria-label="Max retries" max={9} min={0} onChange={setValue} value={value} />;
  },
};
