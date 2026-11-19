import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button/Button";
import { SettingsRow } from "../SettingsRow/SettingsRow";
import { SettingsPanel } from "./SettingsPanel";

const meta: Meta<typeof SettingsPanel> = {
  title: "DesignSystem/SettingsPanel",
  component: SettingsPanel,
  args: {
    title: "Schedulers",
    description: "How often each loop wakes up, in hours and minutes.",
    children: (
      <>
        <SettingsRow hint="Turns goals into next tasks." label="Task planner" />
        <SettingsRow
          changed
          hint="Reads Slack and mail threads."
          label="Channel watch"
          was="2 min"
        />
      </>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof SettingsPanel>;

export const Default: Story = {};
export const Dirty: Story = {
  args: {
    tone: "dirty",
    actions: (
      <>
        <Button intent="ghost" size="sm">
          Discard
        </Button>
        <Button intent="ink" size="sm">
          Save
        </Button>
      </>
    ),
  },
};
export const Collapsible: Story = { args: { collapsible: true, open: true } };
export const NotSetUp: Story = { args: { tone: "dashed" } };
