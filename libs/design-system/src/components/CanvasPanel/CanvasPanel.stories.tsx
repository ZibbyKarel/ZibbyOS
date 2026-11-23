import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button/Button";
import { CanvasPanel, type CanvasPanelProps } from "./CanvasPanel";

const meta: Meta<typeof CanvasPanel> = {
  title: "DesignSystem/CanvasPanel",
  component: CanvasPanel,
  parameters: { layout: "padded" },
  argTypes: {
    status: { control: "radio", options: ["loading", "ready", "error", "unresponsive"] },
    full: { control: "boolean" },
    errorCount: { control: "number" },
  },
};
export default meta;

type Story = StoryObj<typeof CanvasPanel>;

const base: CanvasPanelProps = { src: "about:blank", title: "Pipeline overview", version: 3 };

const box = "h-[260px] w-full max-w-[640px]";

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className={box}>
        <CanvasPanel {...base} status="loading" />
      </div>
      <div className={box}>
        <CanvasPanel {...base} errorCount={2} status="ready" />
      </div>
      <div className={box}>
        <CanvasPanel
          {...base}
          actions={<Button size="sm">Ask Zibby to fix it</Button>}
          message="The page threw an error on start."
          status="error"
        />
      </div>
      <div className={box}>
        <CanvasPanel
          {...base}
          actions={<Button size="sm">Reload</Button>}
          message="The page stopped responding."
          status="unresponsive"
        />
      </div>
    </div>
  ),
};

export const Playground: Story = {
  args: { ...base, status: "ready", full: false, errorCount: 0 },
  render: (args) => (
    <div className={box}>
      <CanvasPanel {...args} message="Something went wrong." />
    </div>
  ),
};
