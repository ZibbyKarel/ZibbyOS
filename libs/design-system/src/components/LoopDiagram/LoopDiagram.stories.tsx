import type { Meta, StoryObj } from "@storybook/react";
import { LoopDiagram, LoopDiagramNode } from "./LoopDiagram";

const node = (name: string) => (
  <div className="rounded-lg border border-line-2 bg-panel p-[14px] text-body">{name}</div>
);

const meta: Meta<typeof LoopDiagram> = {
  title: "DesignSystem/LoopDiagram",
  component: LoopDiagram,
  args: {
    maker: node("Maker · Writer Dev"),
    verifier: node("Verifier · fresh · opus"),
    count: "4 / 8",
    countLabel: "iteration",
    forwardLabel: "result → judge",
    backLabel: "verdict + feedback → retry",
  },
};
export default meta;

type Story = StoryObj<typeof LoopDiagram>;

export const Rest: Story = {};
export const MakerWorking: Story = { args: { active: "forward" } };
export const VerifierJudging: Story = { args: { active: "back" } };
export const Paused: Story = { args: { paused: true, backLabel: "paused · needs you" } };

export const WithNodes: Story = {
  args: {
    active: "forward",
    maker: (
      <LoopDiagramNode
        kicker="Maker"
        line="Changing auth/session.ts…"
        onClick={() => undefined}
        state="active"
        subtitle="agent · sonnet · medium"
        title="Writer Dev"
      />
    ),
    verifier: (
      <LoopDiagramNode
        kicker="Verifier"
        line="Judges against the pass criteria"
        subtitle="fresh · opus · high"
        title="Fresh verifier"
      />
    ),
  },
};
