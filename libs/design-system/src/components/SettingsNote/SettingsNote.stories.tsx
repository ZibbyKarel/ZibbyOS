import type { Meta, StoryObj } from "@storybook/react";
import { SettingsNote } from "./SettingsNote";

const meta: Meta<typeof SettingsNote> = {
  title: "DesignSystem/SettingsNote",
  component: SettingsNote,
  args: { children: "Stored only in this browser. It never touches the server's disk." },
};
export default meta;

type Story = StoryObj<typeof SettingsNote>;

export const Info: Story = {};
export const Wait: Story = {
  args: { tone: "wait", children: "ci-monitor is stale. Red builds may go unnoticed." },
};
export const Error: Story = { args: { tone: "err", children: "Could not reach the daemon." } };
export const Sky: Story = { args: { tone: "sky", children: "Version 1.3 is available." } };
