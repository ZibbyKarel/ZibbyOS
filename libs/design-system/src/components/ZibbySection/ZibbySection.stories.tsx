import type { Meta, StoryObj } from "@storybook/react";
import { ZibbyOrb } from "../ZibbyOrb/ZibbyOrb";
import { ZibbySection, ZibbySectionOrbButton, ZibbySectionStatusButton } from "./ZibbySection";

const meta: Meta<typeof ZibbySection> = {
  title: "DesignSystem/ZibbySection",
  component: ZibbySection,
};
export default meta;

export const Statuses: StoryObj<typeof ZibbySection> = {
  render: () => (
    <div className="flex items-center gap-4 p-6 text-ink">
      {(
        [
          ["run", "think", "Running"],
          ["paused", "sleep", "Paused"],
        ] as const
      ).map(([status, orb, label]) => (
        <ZibbySection ariaLabel="Zibby" key={status} status={status}>
          <ZibbySectionOrbButton aria-label="Ask Zibby" orb={<ZibbyOrb size={20} state={orb} />}>
            Zibby
          </ZibbySectionOrbButton>
          <ZibbySectionStatusButton aria-label={label} label={label} />
        </ZibbySection>
      ))}
    </div>
  ),
};
