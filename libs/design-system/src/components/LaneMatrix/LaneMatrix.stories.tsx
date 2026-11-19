import type { Meta, StoryObj } from "@storybook/react";
import { LaneCell } from "../LaneCell/LaneCell";
import { LaneChip } from "../LaneChip/LaneChip";
import { LaneHead, LaneMatrix } from "./LaneMatrix";

const meta: Meta<typeof LaneMatrix> = { title: "DesignSystem/LaneMatrix", component: LaneMatrix };
export default meta;

export const Default: StoryObj<typeof LaneMatrix> = {
  render: () => (
    <div className="text-ink">
      <LaneMatrix
        columns={[
          { key: "s", header: <LaneHead meaning="Waits for approval" title="Semi" tone="semi" /> },
          { key: "a", header: <LaneHead meaning="Does and reports" title="Auto" tone="auto" /> },
        ]}
        rowHeader="Company / team"
        rows={[
          {
            key: "acme",
            header: "Acme",
            cells: [
              <LaneCell key="s" role="group">
                <LaneChip own pressed tone="semi">
                  Review
                </LaneChip>
              </LaneCell>,
              <LaneCell capped key="a" role="group">
                <LaneChip pressed={false} tone="auto">
                  CI
                </LaneChip>
              </LaneCell>,
            ],
          },
          {
            key: "team",
            header: "Platform",
            nested: true,
            cells: [<LaneCell key="s" />, <LaneCell key="a" />],
          },
        ]}
      />
    </div>
  ),
};
