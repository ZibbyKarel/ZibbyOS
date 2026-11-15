import type { Meta, StoryObj } from "@storybook/react";
import { ZibbyAttachmentChip } from "../ZibbyAttachmentChip/ZibbyAttachmentChip";
import { ZibbyAttachmentRow } from "./ZibbyAttachmentRow";

const meta: Meta<typeof ZibbyAttachmentRow> = {
  title: "DesignSystem/ZibbyAttachmentRow",
  component: ZibbyAttachmentRow,
  argTypes: { align: { control: "inline-radio", options: ["start", "end"] } },
};
export default meta;

type Story = StoryObj<typeof ZibbyAttachmentRow>;

const chips = (
  <>
    <ZibbyAttachmentChip
      kind="code"
      name="pipeline-8815.log"
      onRemove={() => {}}
      sizeLabel="47 kB"
    />
    <ZibbyAttachmentChip kind="pdf" name="smlouva.pdf" onRemove={() => {}} sizeLabel="320 kB" />
    <ZibbyAttachmentChip kind="sheet" name="rozpocet.xlsx" sizeLabel="88 kB" />
  </>
);

export const Overview: Story = {
  render: () => (
    <div className="flex w-[560px] flex-col gap-4 text-ink">
      <ZibbyAttachmentRow>{chips}</ZibbyAttachmentRow>
      <ZibbyAttachmentRow align="end">{chips}</ZibbyAttachmentRow>
    </div>
  ),
};

export const Playground: Story = {
  args: { align: "start" },
  render: (args) => (
    <div className="w-[560px] text-ink">
      <ZibbyAttachmentRow {...args}>{chips}</ZibbyAttachmentRow>
    </div>
  ),
};
