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

const maker = (
  <LoopDiagramNode
    kicker="Maker"
    line="Changing auth/session.ts…"
    onClick={() => undefined}
    state="active"
    subtitle="agent · sonnet · medium"
    title="Writer Dev"
  />
);
const verifier = (
  <LoopDiagramNode
    kicker="Verifier"
    line="Judges against the pass criteria"
    subtitle="fresh · opus · high"
    title="Fresh verifier"
  />
);

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <LoopDiagram
        backLabel="verdict + feedback → retry"
        count="4 / 8"
        countLabel="iteration"
        forwardLabel="result → judge"
        maker={node("Maker · rest")}
        verifier={node("Verifier · rest")}
      />
      <LoopDiagram
        board
        active="forward"
        backLabel="verdict + feedback → retry"
        count="4 / 8"
        countLabel="iteration"
        forwardLabel="result → judge"
        maker={maker}
        verifier={verifier}
      />
      <LoopDiagram
        active="back"
        backLabel="verdict + feedback → retry"
        count="5 / 8"
        countLabel="iteration"
        forwardLabel="result → judge"
        maker={node("Maker")}
        verifier={node("Verifier · judging")}
      />
      <LoopDiagram
        paused
        backLabel="paused · needs you"
        count="6 / 8"
        countLabel="iteration"
        forwardLabel="result → judge"
        maker={node("Maker")}
        verifier={
          <LoopDiagramNode kicker="Verifier" line="Can't decide" state="wait" title="Verifier" />
        }
      />
      <LoopDiagram
        mini
        backLabel=""
        count="2 / 8"
        countLabel="iteration"
        forwardLabel=""
        maker={<LoopDiagramNode mini kicker="Maker" title="Writer Dev" />}
        verifier={<LoopDiagramNode mini kicker="Verifier" title="Fresh" />}
      />
    </div>
  ),
};

export const Playground: Story = {
  argTypes: {
    active: { control: "select", options: [null, "forward", "back"] },
  },
};
