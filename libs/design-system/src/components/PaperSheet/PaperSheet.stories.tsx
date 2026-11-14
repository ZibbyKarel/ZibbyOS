import type { Meta, StoryObj } from "@storybook/react";
import { PaperAdd, PaperLine, PaperSheet } from "./PaperSheet";

const meta: Meta<typeof PaperSheet> = {
  title: "DesignSystem/PaperSheet",
  component: PaperSheet,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof PaperSheet>;

export const Todo: Story = {
  render: () => (
    <PaperSheet>
      <PaperLine checkLabel="Done" onCheck={() => {}} text="Fix the staging deploy, ask @anna" />
      <PaperLine checkLabel="Done" onCheck={() => {}} text="Reply to the vendor" />
      <PaperAdd>
        <span className="text-meta text-ink-3">Add an item…</span>
      </PaperAdd>
    </PaperSheet>
  ),
};
export const Empty: Story = {
  render: () => (
    <PaperSheet>
      <PaperAdd>
        <span className="text-meta text-ink-3">Add an item…</span>
      </PaperAdd>
    </PaperSheet>
  ),
};
