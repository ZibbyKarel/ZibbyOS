import type { Meta, StoryObj } from "@storybook/react";
import { ZibbyToast } from "./ZibbyToast";

const meta: Meta<typeof ZibbyToast> = {
  title: "DesignSystem/ZibbyToast",
  component: ZibbyToast,
};
export default meta;

type Story = StoryObj<typeof ZibbyToast>;

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <ZibbyToast actionLabel="Undo" message="Conversation deleted" />
      <ZibbyToast actionLabel="Undo" message="Conversation cleared" />
      <ZibbyToast message="Renamed" />
    </div>
  ),
};

export const Playground: Story = {
  args: { message: "Conversation deleted", actionLabel: "Undo" },
};
