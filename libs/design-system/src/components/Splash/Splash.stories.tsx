import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { Splash } from "./Splash";

const meta: Meta<typeof Splash> = {
  title: "DesignSystem/Splash",
  component: Splash,
  parameters: { backgrounds: { default: "velin" }, layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof Splash>;

const STEPS = ["Waking agents", "Loading memory", "Checking runs", "Preparing the bridge", "Ready"];

export const Overview: Story = {
  render: () => (
    <div className="relative h-[620px] w-full">
      <Splash footer="zibby os v0.9 · Bridge" ready={false} status="Loading" steps={STEPS} />
    </div>
  ),
};

export const Playground: Story = {
  args: { ready: false, steps: STEPS, status: "Loading", footer: "zibby os v0.9 · Bridge" },
  render: (args) => {
    function Replayable() {
      const [ready, setReady] = useState(args.ready);
      const [key, setKey] = useState(0);
      useEffect(() => setReady(args.ready), [args.ready]);
      return (
        <div className="relative h-[620px] w-full" onClick={() => setKey((k) => k + 1)}>
          <Splash key={key} {...args} ready={ready} />
        </div>
      );
    }
    return <Replayable />;
  },
};
