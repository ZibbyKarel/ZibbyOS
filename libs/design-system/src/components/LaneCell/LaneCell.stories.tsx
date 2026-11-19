import type { Meta, StoryObj } from "@storybook/react";
import { LaneChip } from "../LaneChip/LaneChip";
import { LaneCell } from "./LaneCell";

const meta: Meta<typeof LaneCell> = { title: "DesignSystem/LaneCell", component: LaneCell };
export default meta;

export const States: StoryObj<typeof LaneCell> = {
  render: () => (
    <div className="grid w-[420px] gap-2 text-ink">
      <LaneCell>
        <LaneChip pressed tone="auto">
          Review
        </LaneChip>
        <LaneChip pressed={false} tone="auto">
          CI
        </LaneChip>
      </LaneCell>
      <LaneCell capped>
        <LaneChip pressed tone="semi">
          Review
        </LaneChip>
      </LaneCell>
    </div>
  ),
};
