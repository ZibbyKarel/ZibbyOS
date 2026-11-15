import type { Meta, StoryObj } from "@storybook/react";
import { ZibbyFooter } from "./ZibbyFooter";

const meta: Meta<typeof ZibbyFooter> = {
  title: "DesignSystem/ZibbyFooter",
  component: ZibbyFooter,
};
export default meta;

type Story = StoryObj<typeof ZibbyFooter>;

const end = "Esc zavře · ⌥ Space vyvolá · soubory přetáhni kamkoli";

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="w-[720px]">
        <ZibbyFooter end={end} start={<span>Hlas zapnutý</span>} />
      </div>
      <div className="w-[300px]">
        <ZibbyFooter end={end} start={<span>Hlas zapnutý</span>} />
      </div>
    </div>
  ),
};

export const Playground: Story = {
  args: { start: "Hlas zapnutý", end },
  render: (args) => (
    <div className="w-[720px]">
      <ZibbyFooter {...args} />
    </div>
  ),
};
