import type { Meta, StoryObj } from "@storybook/react";
import { UnsavedBar } from "./UnsavedBar";

const meta: Meta<typeof UnsavedBar> = {
  title: "DesignSystem/UnsavedBar",
  component: UnsavedBar,
  parameters: { layout: "fullscreen" },
  args: {
    title: "3 unsaved changes",
    items: ["Instructions", "Model tier", "Identity"],
    discardLabel: "Discard",
    saveLabel: "Save",
    shortcut: "⌘S",
    onDiscard: () => {},
    onSave: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof UnsavedBar>;

export const Default: Story = {};
export const Saving: Story = { args: { saving: true } };
export const WithError: Story = { args: { error: "Operator token needed to save." } };
