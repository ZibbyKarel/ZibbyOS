import type { Meta, StoryObj } from "@storybook/react";
import { LaneChip } from "./LaneChip";

const meta: Meta<typeof LaneChip> = { title: "DesignSystem/LaneChip", component: LaneChip };
export default meta;

export const Variants: StoryObj<typeof LaneChip> = {
  render: () => (
    <div className="flex gap-2 text-ink">
      <LaneChip tone="semi">Semi</LaneChip>
      <LaneChip own tone="auto">
        Auto, own
      </LaneChip>
      <LaneChip inherited tone="auto">
        Inherited (borderless)
      </LaneChip>
    </div>
  ),
};
