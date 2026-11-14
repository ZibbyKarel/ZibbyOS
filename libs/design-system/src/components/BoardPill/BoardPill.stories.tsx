import type { Meta, StoryObj } from "@storybook/react";
import { BoardPill } from "./BoardPill";

const meta: Meta<typeof BoardPill> = {
  title: "DesignSystem/BoardPill",
  component: BoardPill,
  argTypes: {
    tone: { control: "radio", options: ["you", "blocked", "error", "done", "neutral"] },
  },
  args: { tone: "you", children: "Tvoje review" },
};
export default meta;

type Story = StoryObj<typeof BoardPill>;

export const Overview: Story = {
  render: () => (
    <div className="flex gap-3">
      <BoardPill tone="you">Tvoje review</BoardPill>
      <BoardPill tone="blocked">Změny</BoardPill>
      <BoardPill tone="error">CI selhává</BoardPill>
      <BoardPill tone="done">Schváleno</BoardPill>
      <BoardPill tone="neutral">Čeká na review</BoardPill>
    </div>
  ),
};
export const Playground: Story = {};
