import type { Meta, StoryObj } from "@storybook/react";
import { RadioCard, RadioCardGroup } from "./RadioCard";

const meta: Meta<typeof RadioCardGroup> = {
  title: "DesignSystem/RadioCard",
  component: RadioCardGroup,
};
export default meta;

export const Modes: StoryObj<typeof RadioCardGroup> = {
  render: () => (
    <div className="w-[380px] text-ink">
      <RadioCardGroup ariaLabel="Mode">
        <RadioCard disabled checked={false} hint="Sleeps" label="Manual" />
        <RadioCard checked hint="Thinks" label="Semi" tone="violet" />
        <RadioCard checked={false} hint="Speaks" label="Auto" tone="amber" />
      </RadioCardGroup>
    </div>
  ),
};
