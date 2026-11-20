import type { Meta, StoryObj } from "@storybook/react";
import { PortraitCard } from "./PortraitCard";

const meta: Meta<typeof PortraitCard> = {
  title: "DesignSystem/PortraitCard",
  component: PortraitCard,
  args: {
    name: "Architekt",
    role: "Návrh a rozpad práce",
    tag: "ENG",
    engine: "claude",
    model: "opus-5.5",
    effort: { level: 3, label: "vysoká" },
    now: { text: "Právě: Plán · #482", tone: "run" },
    stats: [
      { value: "42", label: "Běhy 7 d" },
      { value: "96 %", label: "Úspěšnost" },
      { value: "$18", label: "Cena 7 d" },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof PortraitCard> = {};
export const AgentGlyph: StoryObj<typeof PortraitCard> = {
  args: { glyph: "shield", hue: "#a78bfa" },
};
