import type { Meta, StoryObj } from "@storybook/react";
import { StateDot } from "../StatusRail/StatusRail";
import { Tile, TileGrid } from "./TileGrid";

const meta: Meta<typeof TileGrid> = {
  title: "DesignSystem/TileGrid",
  component: TileGrid,
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TileGrid>;

export const Default: Story = {
  render: () => (
    <TileGrid>
      <Tile
        lead={<StateDot size="sm" tone="done" />}
        onClick={() => {}}
        sub="master"
        title="cms4"
      />
      <Tile
        alert
        lead={<StateDot size="sm" tone="error" />}
        onClick={() => {}}
        sub="develop"
        title="Partner CLI"
      />
      <Tile
        selected
        lead={<StateDot size="sm" tone="idle" />}
        onClick={() => {}}
        sub="main"
        title="Knowledge base"
      />
    </TileGrid>
  ),
};
