import type { Meta, StoryObj } from "@storybook/react";
import { ZibbyOrb } from "../ZibbyOrb/ZibbyOrb";
import { ZibbySection, ZibbySectionModeButton, ZibbySectionOrbButton } from "./ZibbySection";

const meta: Meta<typeof ZibbySection> = {
  title: "DesignSystem/ZibbySection",
  component: ZibbySection,
};
export default meta;

export const Modes: StoryObj<typeof ZibbySection> = {
  render: () => (
    <div className="flex items-center gap-4 p-6 text-ink">
      {(
        [
          ["manual", "sleep", "Manual"],
          ["semi", "think", "Semi"],
          ["auto", "speak", "Auto"],
        ] as const
      ).map(([mode, orb, label]) => (
        <ZibbySection ariaLabel="Zibby" key={mode} mode={mode}>
          <ZibbySectionOrbButton aria-label="Ask Zibby" orb={<ZibbyOrb size={20} state={orb} />}>
            Zibby
          </ZibbySectionOrbButton>
          <ZibbySectionModeButton aria-label={label} label={label} mode={mode} />
        </ZibbySection>
      ))}
    </div>
  ),
};
