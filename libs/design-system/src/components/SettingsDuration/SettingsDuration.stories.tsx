import type { Meta, StoryObj } from "@storybook/react";
import { SettingsDuration } from "./SettingsDuration";

const meta: Meta<typeof SettingsDuration> = {
  title: "DesignSystem/SettingsDuration",
  component: SettingsDuration,
  args: {
    label: "Task planner",
    value: 90,
    hoursLabel: "hours",
    minutesLabel: "minutes",
    onChange: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof SettingsDuration>;

export const Default: Story = {};
export const Changed: Story = { args: { changed: true } };
