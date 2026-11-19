import type { Meta, StoryObj } from "@storybook/react";
import { SettingsRow } from "./SettingsRow";

const meta: Meta<typeof SettingsRow> = {
  title: "DesignSystem/SettingsRow",
  component: SettingsRow,
  args: { label: "Task planner", hint: "Turns goals into next tasks." },
};
export default meta;

type Story = StoryObj<typeof SettingsRow>;

export const Default: Story = {};
export const Changed: Story = { args: { changed: true, was: "5 min" } };
export const Disabled: Story = { args: { disabled: true } };
