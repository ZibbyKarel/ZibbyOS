import type { Meta, StoryObj } from "@storybook/react";
import { SegmentedRing } from "./SegmentedRing";

const meta: Meta<typeof SegmentedRing> = {
  title: "DesignSystem/SegmentedRing",
  component: SegmentedRing,
  args: { used: 7, max: 12, tone: "working", caption: "z 12 iterací", ariaLabel: "7 z 12 iterací" },
};
export default meta;
type Story = StoryObj<typeof SegmentedRing>;

export const Overview: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <SegmentedRing ariaLabel="7 z 12" caption="z 12 iterací" max={12} tone="working" used={7} />
      <SegmentedRing ariaLabel="9 z 10" caption="z 10" max={10} tone="blocked" used={9} />
      <SegmentedRing
        ariaLabel="zatím neběžel"
        caption="zatím neběžel"
        max={1}
        tone="idle"
        used={0}
        value="–"
      />
      <SegmentedRing ariaLabel="2 z 3" max={3} size={56} tone="done" used={2} />
    </div>
  ),
};

export const Playground: Story = {};
