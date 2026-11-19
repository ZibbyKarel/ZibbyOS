import type { Meta, StoryObj } from "@storybook/react";
import { LaneChip } from "../LaneChip/LaneChip";
import { LaneCell } from "./LaneCell";

const meta: Meta<typeof LaneCell> = { title: "DesignSystem/LaneCell", component: LaneCell };
export default meta;

export const States: StoryObj<typeof LaneCell> = {
  render: () => (
    <div className="grid w-[420px] gap-2 text-ink">
      <LaneCell empty="Empty" />
      <LaneCell capped tone="auto">
        <LaneChip tone="auto">Review</LaneChip>
      </LaneCell>
      <LaneCell dropTarget empty="Drop here" tone="semi" />
    </div>
  ),
};
