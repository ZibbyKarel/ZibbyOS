import type { Meta, StoryObj } from "@storybook/react";
import { CanvasCard } from "./CanvasCard";

const meta: Meta<typeof CanvasCard> = {
  title: "DesignSystem/CanvasCard",
  component: CanvasCard,
  argTypes: { size: { control: "radio", options: ["card", "pin"] } },
};
export default meta;

type Story = StoryObj<typeof CanvasCard>;

export const Overview: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-4">
      <CanvasCard onOpen={() => {}} src="about:blank" title="Pipeline overview" version={2} />
      <CanvasCard
        href="https://example.com"
        note="Open on the Mac"
        src="about:blank"
        title="Pipeline overview"
        version={2}
      />
      <CanvasCard
        onOpen={() => {}}
        size="pin"
        src="about:blank"
        title="Pipeline overview"
        version={2}
      />
    </div>
  ),
};

export const Playground: Story = {
  args: { title: "Pipeline overview", src: "about:blank", version: 1, size: "card", note: "" },
  render: (args) => <CanvasCard {...args} note={args.note || undefined} onOpen={() => {}} />,
};
