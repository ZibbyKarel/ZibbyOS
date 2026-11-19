import type { Meta, StoryObj } from "@storybook/react";
import { FlowTilePair } from "./FlowTilePair";

const meta: Meta<typeof FlowTilePair> = {
  title: "DesignSystem/FlowTilePair",
  component: FlowTilePair,
  args: {
    trigger: { icon: "⏱", kicker: "KDY", title: "Každý den v 8:00", code: "0 8 * * *" },
    target: { icon: "D", kicker: "AGENT", title: "Dispečer" },
  },
};
export default meta;
export const Default: StoryObj<typeof FlowTilePair> = {};
export const Off: StoryObj<typeof FlowTilePair> = { args: { off: true } };
