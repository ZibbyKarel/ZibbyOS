import type { Meta, StoryObj } from "@storybook/react";
import { SettingsStepper } from "./SettingsStepper";

const meta: Meta<typeof SettingsStepper> = {
  title: "DesignSystem/SettingsStepper",
  component: SettingsStepper,
  args: { label: "Max concurrent runs", value: 3, min: 1, max: 12, onChange: () => {} },
};
export default meta;

type Story = StoryObj<typeof SettingsStepper>;

export const Default: Story = {};
export const Changed: Story = { args: { changed: true } };
