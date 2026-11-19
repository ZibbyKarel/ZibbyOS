import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "./StatusBadge";

const meta: Meta<typeof StatusBadge> = {
  title: "DesignSystem/StatusBadge",
  component: StatusBadge,
  args: { children: "Connected", tone: "ok" },
};
export default meta;

type Story = StoryObj<typeof StatusBadge>;

export const Ok: Story = {};
export const Waits: Story = { args: { tone: "wait", children: "Needs token" } };
export const Off: Story = { args: { tone: "off", children: "Disabled" } };
export const Error: Story = { args: { tone: "err", children: "Failed" } };
export const Info: Story = { args: { tone: "info", children: "Update available" } };
