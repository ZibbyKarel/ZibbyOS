import type { Meta, StoryObj } from "@storybook/react";
import { Kbd } from "../Kbd/Kbd";
import { ZibbyOrb } from "../ZibbyOrb/ZibbyOrb";
import { ZibbyChip } from "./ZibbyChip";

const meta: Meta<typeof ZibbyChip> = {
  title: "DesignSystem/ZibbyChip",
  component: ZibbyChip,
};
export default meta;

type Story = StoryObj<typeof ZibbyChip>;

export const Overview: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-ink">
      <ZibbyChip
        kbd={<Kbd>⌥ Space</Kbd>}
        label="Vyvolat Zibbyho (⌥ Space)"
        orb={<ZibbyOrb size={20} state="needs" />}
      >
        Zibby
      </ZibbyChip>
      <ZibbyChip label="Vyvolat Zibbyho" orb={<ZibbyOrb size={20} />}>
        Zibby
      </ZibbyChip>
    </div>
  ),
};

export const Playground: Story = {
  args: { label: "Vyvolat Zibbyho (⌥ Space)", children: "Zibby" },
};
