import type { Meta, StoryObj } from "@storybook/react";
import { BoardSection } from "./BoardSection";

const meta: Meta<typeof BoardSection> = {
  title: "DesignSystem/BoardSection",
  component: BoardSection,
  args: { label: "Queued", count: "03" },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof BoardSection>;

export const Default: Story = {};
export const Accent: Story = { args: { label: "Parked", tone: "accent" } };
export const Collapsible: Story = { args: { onToggle: () => {}, closed: true } };
