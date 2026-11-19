import type { Meta, StoryObj } from "@storybook/react";
import { IterationTimeline, IterationTimelineItem } from "./IterationTimeline";

const meta: Meta<typeof IterationTimeline> = {
  title: "DesignSystem/IterationTimeline",
  component: IterationTimeline,
  args: { ariaLabel: "Iterations" },
};
export default meta;

type Story = StoryObj<typeof IterationTimeline>;

export const Default: Story = {
  render: (args) => (
    <IterationTimeline {...args}>
      <IterationTimelineItem
        marker={2}
        meta={
          <>
            <span>1m 48s</span>
            <span>$0.21</span>
          </>
        }
        rows={[
          { label: "Maker", icon: "check", tone: "ok", text: "Added 3 tests" },
          { label: "Verifier", icon: "dots", text: "Judging…" },
        ]}
        title="Iteration 2"
        tone="run"
      />
      <IterationTimelineItem
        expanded
        marker={1}
        meta={
          <>
            <span>3m 12s</span>
            <span>$0.31</span>
          </>
        }
        onToggle={() => undefined}
        rows={[
          { label: "Maker", icon: "check", tone: "ok", text: "Added rememberMe checkbox" },
          { label: "Verifier", icon: "x", tone: "bad", text: "Session lost after restart." },
        ]}
        title="Iteration 1"
        tone="bad"
      >
        <pre className="font-mono text-meta">13:41:22 VERDICT: fail</pre>
      </IterationTimelineItem>
    </IterationTimeline>
  ),
};
