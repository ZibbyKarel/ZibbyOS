import type { Meta, StoryObj } from "@storybook/react";
import { RailItem } from "./RailItem";

const meta: Meta<typeof RailItem> = {
  title: "DesignSystem/RailItem",
  component: RailItem,
  args: { title: "2 · Build", meta: "RUNNING · 01:12", leading: "●", selected: false },
};
export default meta;

type Story = StoryObj<typeof RailItem>;

const STAGES = ["Plan", "Build", "Review", "Test", "Docs"];

export const Overview: Story = {
  render: () => (
    <div className="flex w-[260px] flex-col border border-border">
      {STAGES.map((s, i) => (
        <RailItem
          key={s}
          leading="●"
          meta={i === 0 ? "DONE · 00:42" : i === 1 ? "RUNNING · 01:12" : "PENDING"}
          selected={i === 1}
          title={`${i + 1} · ${s}`}
        />
      ))}
    </div>
  ),
};

/** Stage rail timeline: past (check, muted), present (pulsing marker), future (dashed). */
export const Timeline: Story = {
  render: () => (
    <div className="flex w-[300px] flex-col border border-border">
      <RailItem aside="0:41" meta="ran: switchboard · Haiku" tense="past" title="Intake">
        <span>Switchboard → Engineering → Delivery · 92%</span>
      </RailItem>
      <RailItem aside="3:12" meta="ran: architect · Opus" tense="past" title="Plan">
        <span>checkpoint · 3f9a2c1</span>
      </RailItem>
      <RailItem
        running
        selected
        aside="running · 4:02"
        meta="now: coder · Sonnet"
        tense="present"
        title="Build"
      >
        <span>Round 1 · Round 2</span>
      </RailItem>
      <RailItem
        aside="waiting"
        markerTone="blocked"
        meta="now: publisher · Haiku"
        tense="present"
        title="Publish"
      />
      <RailItem meta="will run: qa-browser · Sonnet" tense="future" title="Browser QA" />
    </div>
  ),
};

export const Playground: Story = {};
