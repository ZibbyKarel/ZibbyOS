import type { Meta, StoryObj } from "@storybook/react";
import { IconTile } from "../IconTile/IconTile";
import { ConnectionAddTile, ConnectionTile } from "./ConnectionTile";

const meta: Meta<typeof ConnectionTile> = {
  title: "DesignSystem/ConnectionTile",
  component: ConnectionTile,
  decorators: [
    (Story) => (
      <div className="w-[220px]">
        <Story />
      </div>
    ),
  ],
  args: {
    mark: <IconTile glyph="jira" size="sm" />,
    name: "Jira",
    status: "Connected",
    health: "ok",
    origin: "own",
    meta: ["synced 2 min ago", "API token · 41 d left"],
    serves: "→ 4 projects",
  },
};
export default meta;
type Story = StoryObj<typeof ConnectionTile>;

export const Own: Story = {};
export const Inherited: Story = {
  args: { origin: "inherited", sourceLabel: "From Acme Logistics" },
};
export const Down: Story = { args: { health: "bad", status: "Token revoked" } };
export const Expiring: Story = { args: { health: "warn", status: "Expires in 6 d" } };
export const Add: Story = {
  render: () => (
    <ConnectionAddTile hint="Jira, GitHub, Slack" label="Connect" onClick={() => undefined} />
  ),
};
