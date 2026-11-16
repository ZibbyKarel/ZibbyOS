import type { Meta, StoryObj } from "@storybook/react";
import { IconTile } from "../IconTile/IconTile";
import { EngineBadge } from "./EngineBadge";

const meta: Meta<typeof EngineBadge> = {
  title: "DesignSystem/EngineBadge",
  component: EngineBadge,
  args: { engine: "claude" },
  argTypes: { engine: { control: "radio", options: ["claude", "openai", "opencode"] } },
};
export default meta;

type Story = StoryObj<typeof EngineBadge>;

export const Overview: Story = {
  render: () => (
    <div className="flex items-center gap-6 p-4">
      {(["claude", "openai", "opencode"] as const).map((engine) => (
        <EngineBadge engine={engine} key={engine}>
          <IconTile glyph="bot" size="lg" />
        </EngineBadge>
      ))}
      <EngineBadge engine="claude">
        <IconTile glyph="bot" size="sm" />
      </EngineBadge>
    </div>
  ),
};

export const MultiEngine: Story = {
  render: () => (
    <div className="flex items-center gap-6 p-4">
      <EngineBadge engines={["claude", "opencode"]}>
        <IconTile glyph="flow" size="md" />
      </EngineBadge>
      <EngineBadge engines={["claude", "openai", "opencode"]}>
        <IconTile glyph="flow" size="lg" />
      </EngineBadge>
    </div>
  ),
};

export const Playground: Story = {
  render: (args) => (
    <div className="p-4">
      <EngineBadge {...args}>
        <IconTile glyph="bot" size="lg" />
      </EngineBadge>
    </div>
  ),
};
