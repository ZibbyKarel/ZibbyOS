import type { Meta, StoryObj } from "@storybook/react";
import { ZibbyAttachmentChip } from "./ZibbyAttachmentChip";

const meta: Meta<typeof ZibbyAttachmentChip> = {
  title: "DesignSystem/ZibbyAttachmentChip",
  component: ZibbyAttachmentChip,
  argTypes: { kind: { control: "select", options: ["image", "pdf", "code", "sheet", "file"] } },
};
export default meta;

type Story = StoryObj<typeof ZibbyAttachmentChip>;

const img =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><rect width='26' height='26' fill='%23f5a524'/></svg>";

export const Overview: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 text-ink">
      <ZibbyAttachmentChip kind="image" name="screenshot.png" sizeLabel="1,2 MB" src={img} />
      <ZibbyAttachmentChip kind="image" name="no-thumb.png" sizeLabel="3 kB" />
      <ZibbyAttachmentChip kind="pdf" name="smlouva.pdf" sizeLabel="320 kB" />
      <ZibbyAttachmentChip
        kind="code"
        name="pipeline-8815.log"
        onRemove={() => {}}
        removeLabel="Odebrat pipeline-8815.log"
        sizeLabel="47 kB"
      />
      <ZibbyAttachmentChip kind="sheet" name="rozpocet.xlsx" sizeLabel="88 kB" />
      <ZibbyAttachmentChip
        name="velmi-dlouhy-nazev-souboru-ktery-se-musi-zkratit-na-konci.bin"
        onRemove={() => {}}
        sizeLabel="5 MB"
      />
    </div>
  ),
};

export const Playground: Story = {
  args: { name: "pipeline-8815.log", kind: "code", sizeLabel: "47 kB" },
};
