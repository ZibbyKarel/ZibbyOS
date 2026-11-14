import type { Meta, StoryObj } from "@storybook/react";
import { FeedRow } from "./FeedRow";

const meta: Meta<typeof FeedRow> = {
  title: "DesignSystem/FeedRow",
  component: FeedRow,
  args: {
    glyph: "GH",
    glyphLabel: "github",
    who: "anna",
    text: "Can you take another look at this?",
    age: "12m",
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

type Story = StoryObj<typeof FeedRow>;

export const Default: Story = { args: { onClick: () => {} } };
export const Unread: Story = { args: { unread: true, onClick: () => {} } };
export const Selected: Story = { args: { selected: true, onClick: () => {} } };
