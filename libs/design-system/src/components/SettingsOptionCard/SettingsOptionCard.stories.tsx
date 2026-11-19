import type { Meta, StoryObj } from "@storybook/react";
import { SettingsOptionCard, SettingsOptionGroup } from "./SettingsOptionCard";

const meta: Meta<typeof SettingsOptionCard> = {
  title: "DesignSystem/SettingsOptionCard",
  component: SettingsOptionCard,
  decorators: [
    (Story) => (
      <SettingsOptionGroup ariaLabel="Active engine">
        <Story />
      </SettingsOptionGroup>
    ),
  ],
  args: { label: "Claude Code", media: "Cl", checked: true, hint: "v2.1.4" },
};
export default meta;

type Story = StoryObj<typeof SettingsOptionCard>;

export const Checked: Story = {};
export const Unchecked: Story = { args: { checked: false } };
export const NoRadio: Story = { args: { radio: false, hint: "API key below" } };
