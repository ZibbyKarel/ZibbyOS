import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "../Button/Button";
import { CanvasPanel, type CanvasPanelPreviewWidth, type CanvasPanelProps } from "./CanvasPanel";

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

const phase2Versions = [
  { key: "a", label: "v2", at: "Yesterday 10:00", current: false },
  { key: "b", label: "v2.1", at: "Today 11:00", note: "Bigger heading", current: true },
];

export const WithVersions: Story = {
  render: () => (
    <div className={box}>
      <CanvasPanel {...base} versions={phase2Versions} viewingKey="b" />
    </div>
  ),
};

export const ViewingOldVersion: Story = {
  render: () => (
    <div className={box}>
      <CanvasPanel {...base} versions={phase2Versions} viewingKey="a" />
    </div>
  ),
};

export const WithBanner: Story = {
  render: () => (
    <div className="h-[340px] w-full max-w-[640px]">
      <CanvasPanel
        {...base}
        banner={{
          title: "Zibby proposes a change",
          body: "Add a dark theme toggle\nMove the legend below the chart",
          confirmLabel: "Apply",
          onConfirm: () => undefined,
          onDismiss: () => undefined,
        }}
      />
    </div>
  ),
};

export const PreviewWidths: Story = {
  render: function Render() {
    const [w, setW] = useState<CanvasPanelPreviewWidth>("phone");
    return (
      <div className={box}>
        <CanvasPanel {...base} onPreviewWidthChange={setW} previewWidth={w} />
      </div>
    );
  },
};

export const FixAndExport: Story = {
  render: () => (
    <div className={box}>
      <CanvasPanel
        {...base}
        errorCount={2}
        onExport={() => undefined}
        onFixErrors={() => undefined}
        status="ready"
      />
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
