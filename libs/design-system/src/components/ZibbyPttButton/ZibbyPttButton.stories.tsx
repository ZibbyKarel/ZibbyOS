import type { Meta, StoryObj } from "@storybook/react";
import { Kbd } from "../Kbd/Kbd";
import { ZibbyPttButton } from "./ZibbyPttButton";

const meta: Meta<typeof ZibbyPttButton> = {
  title: "DesignSystem/ZibbyPttButton",
  component: ZibbyPttButton,
  argTypes: {
    mode: { control: "inline-radio", options: ["hold", "tap"] },
    size: { control: "inline-radio", options: ["md", "lg"] },
    level: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
  },
};
export default meta;

type Story = StoryObj<typeof ZibbyPttButton>;

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-6 text-ink">
      <div className="flex flex-wrap items-center gap-4">
        <ZibbyPttButton label="Drž a mluv">
          Drž <Kbd>Space</Kbd> a mluv
        </ZibbyPttButton>
        <ZibbyPttButton active label="Drž a mluv">
          Pusť a odešle se
        </ZibbyPttButton>
        <ZibbyPttButton active label="Drž a mluv" level={0.7}>
          Level 0.7
        </ZibbyPttButton>
        <ZibbyPttButton label="Ťukni a mluv" mode="tap">
          Ťukni a mluv
        </ZibbyPttButton>
        <ZibbyPttButton disabled label="Drž a mluv">
          Vypnuto
        </ZibbyPttButton>
      </div>
      <div className="flex items-center gap-8 p-3">
        <ZibbyPttButton label="Drž a mluv" size="lg" />
        <ZibbyPttButton active label="Drž a mluv" size="lg" />
      </div>
    </div>
  ),
};

export const Playground: Story = {
  args: { label: "Drž a mluv", mode: "hold", size: "md", children: "Drž a mluv" },
};
