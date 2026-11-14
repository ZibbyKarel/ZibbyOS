import type { Meta, StoryObj } from "@storybook/react";
import { ReadingItem } from "./ReadingItem";

const meta: Meta<typeof ReadingItem> = {
  title: "DesignSystem/ReadingItem",
  component: ReadingItem,
  args: {
    text: "Who owns the staging deploy after the handover?",
    sub: "Weekly sync · 2026-11-10",
    action: <span className="text-meta text-ink-3">Resolve</span>,
    onClick: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ReadingItem>;

export const Question: Story = {};
export const Agreement: Story = { args: { muted: true, action: undefined } };
