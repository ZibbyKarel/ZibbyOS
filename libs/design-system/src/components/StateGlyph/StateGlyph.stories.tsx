import type { Meta, StoryObj } from "@storybook/react";
import { StateGlyph } from "./StateGlyph";

const meta: Meta<typeof StateGlyph> = {
  title: "DesignSystem/StateGlyph",
  component: StateGlyph,
  args: { tone: "error", icon: "x", label: "CI failing" },
  argTypes: {
    tone: {
      control: "select",
      options: ["working", "thinking", "blocked", "error", "done", "idle", "neutral"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof StateGlyph>;

export const Overview: Story = {
  render: () => (
    <div className="flex gap-3">
      <StateGlyph icon="check" label="CI passing" tone="done" />
      <StateGlyph icon="x" label="CI failing" tone="error" />
      <StateGlyph icon="branch" label="Conflict" tone="blocked" />
      <StateGlyph spin icon="run" label="CI running" tone="thinking" />
      <StateGlyph icon="dots" label="No CI" tone="idle" />
      <StateGlyph icon="jira" label="Jira" tone="neutral" />
    </div>
  ),
};
export const Playground: Story = {};
