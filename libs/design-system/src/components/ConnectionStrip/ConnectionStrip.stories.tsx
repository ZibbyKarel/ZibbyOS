import type { Meta, StoryObj } from "@storybook/react";
import { IconTile } from "../IconTile/IconTile";
import { ConnectionAddTile, ConnectionTile } from "../ConnectionTile/ConnectionTile";
import { ConnectionStrip } from "./ConnectionStrip";

const meta: Meta<typeof ConnectionStrip> = {
  title: "DesignSystem/ConnectionStrip",
  component: ConnectionStrip,
  args: {
    label: "Connections",
    summary: "2 connected · 1 needs attention",
    ownLabel: "own",
    inheritedLabel: "inherited",
  },
};
export default meta;
export const Default: StoryObj<typeof ConnectionStrip> = {
  render: (args) => (
    <ConnectionStrip {...args}>
      <ConnectionTile
        health="ok"
        mark={<IconTile glyph="jira" size="sm" />}
        name="Jira"
        origin="own"
        serves="→ 4 projects"
        status="Connected"
      />
      <ConnectionTile
        health="bad"
        mark={<IconTile glyph="plug" size="sm" />}
        name="Slack"
        origin="inherited"
        sourceLabel="From Acme"
        status="Token revoked"
      />
      <ConnectionAddTile label="Connect" onClick={() => undefined} />
    </ConnectionStrip>
  ),
};
