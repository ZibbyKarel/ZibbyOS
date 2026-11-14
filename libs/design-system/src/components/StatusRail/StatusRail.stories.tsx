import type { Meta, StoryObj } from "@storybook/react";
import { StatusRail, StatusRailItem, StatusRailNow, StatusRailPark } from "./StatusRail";
import { BoardSection } from "../BoardSection/BoardSection";

const meta: Meta<typeof StatusRail> = {
  title: "DesignSystem/StatusRail",
  component: StatusRail,
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof StatusRail>;

export const Default: Story = {
  render: () => (
    <>
      <StatusRailNow aside="next in 11 min" label="Nothing running" />
      <BoardSection count="01" label="Parked" tone="accent" />
      <StatusRailPark
        actions={<button type="button">Detail</button>}
        onClick={() => {}}
        sub="PR rebase · workflow"
        time="21h"
        title="Rebase shoptet/cms4#47385"
        why="Stopped on a conflict in composer.lock."
      />
      <BoardSection count="02" label="Queued" />
      <StatusRail>
        <StatusRailItem
          onClick={() => {}}
          sub="delivery"
          time="in 11 min"
          title="Fix base-branch CI"
          tone="idle"
        />
        <StatusRailItem
          onClick={() => {}}
          sub="scheduled"
          time="1d 4h"
          title="Code review"
          tone="idle"
        />
      </StatusRail>
      <BoardSection count="02" label="Finished" />
      <StatusRail>
        <StatusRailItem
          dim
          onClick={() => {}}
          sub="triage"
          time="1d 6h"
          title="CI triage"
          tone="done"
        />
        <StatusRailItem
          dim
          selected
          onClick={() => {}}
          sub="fix CI"
          time="2d 8h"
          title="Fix CI"
          tone="error"
        />
      </StatusRail>
    </>
  ),
};

export const Running: Story = {
  render: () => (
    <StatusRailNow>
      <StatusRailItem
        onClick={() => {}}
        sub="coder · implement"
        time="3m"
        title="Build feature"
        tone="working"
      />
    </StatusRailNow>
  ),
};
