import type { Meta, StoryObj } from "@storybook/react";
import { LaneChip } from "./LaneChip";

const meta: Meta<typeof LaneChip> = { title: "DesignSystem/LaneChip", component: LaneChip };
export default meta;

export const Variants: StoryObj<typeof LaneChip> = {
  render: () => (
    <div className="flex gap-2 text-ink">
      <LaneChip pressed tone="semi">
        Semi on
      </LaneChip>
      <LaneChip own pressed tone="auto">
        Auto on, exception
      </LaneChip>
      <LaneChip pressed={false} tone="auto">
        Off
      </LaneChip>
    </div>
  ),
};
