import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Splitter } from "./Splitter";

const meta: Meta<typeof Splitter> = {
  title: "DesignSystem/Splitter",
  component: Splitter,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof Splitter>;

export const Overview: Story = {
  render: () => {
    const [width, setWidth] = useState(240);
    return (
      <div className="flex h-64 border border-line">
        <div className="p-3 text-sm text-ink-2" style={{ width }}>
          Pane ({Math.round(width)}px)
        </div>
        <Splitter label="Resize pane" max={480} min={120} onChange={setWidth} value={width} />
        <div className="flex-1 p-3 text-sm text-ink-2">Fills the rest</div>
      </div>
    );
  },
};
