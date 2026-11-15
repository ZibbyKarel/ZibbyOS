import type { Meta, StoryObj } from "@storybook/react";
import { ZIBBY_ORB_STATES, ZibbyOrb } from "./ZibbyOrb";

const meta: Meta<typeof ZibbyOrb> = {
  title: "DesignSystem/ZibbyOrb",
  component: ZibbyOrb,
  argTypes: {
    state: { control: "select", options: ZIBBY_ORB_STATES },
    size: { control: { type: "range", min: 20, max: 320, step: 4 } },
    level: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
  },
};
export default meta;

type Story = StoryObj<typeof ZibbyOrb>;

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-10 text-ink">
      <div className="grid grid-cols-4 gap-x-6 gap-y-8">
        {ZIBBY_ORB_STATES.map((s) => (
          <div className="flex flex-col items-center gap-6" key={s}>
            <ZibbyOrb size={124} state={s} />
            <span className="font-mono text-xs">{s}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-10">
        {[20, 28, 64, 140, 220].map((px) => (
          <div className="flex flex-col items-center gap-6" key={px}>
            <ZibbyOrb size={px} />
            <span className="font-mono text-xs">{px}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-10">
        <ZibbyOrb level={0.15} size={140} state="listen" />
        <ZibbyOrb level={0.9} size={140} state="listen" />
        <ZibbyOrb level={0.9} size={140} state="speak" />
      </div>
    </div>
  ),
};

export const Playground: Story = {
  args: { state: "ready", size: 140, level: 0.4 },
  render: (args) => (
    <div className="p-16 text-ink">
      <ZibbyOrb {...args} />
    </div>
  ),
};
