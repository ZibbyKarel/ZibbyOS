import type { Meta, StoryObj } from "@storybook/react";
import { BrandMark } from "../BrandMark/BrandMark";
import { Wordmark } from "./Wordmark";

const meta: Meta<typeof Wordmark> = {
  title: "DesignSystem/Wordmark",
  component: Wordmark,
  parameters: { backgrounds: { default: "velin" } },
  argTypes: { size: { control: "inline-radio", options: ["md", "lg"] } },
};
export default meta;

type Story = StoryObj<typeof Wordmark>;

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-6 text-ink">
      <Wordmark />
      <Wordmark version="v0.2.1" />
      <Wordmark size="lg" />
      <div className="flex items-center gap-3">
        <BrandMark size={24} />
        <Wordmark />
      </div>
      <div className="flex items-center gap-4">
        <BrandMark live size={48} />
        <Wordmark size="lg" />
      </div>
      <Wordmark>ACME CORP</Wordmark>
    </div>
  ),
};

export const Playground: Story = {
  args: { size: "md", version: "v0.2.1" },
};
