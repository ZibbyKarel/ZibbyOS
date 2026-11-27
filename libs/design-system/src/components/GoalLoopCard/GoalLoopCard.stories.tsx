import type { Meta, StoryObj } from "@storybook/react";
import { GoalLoopCard } from "./GoalLoopCard";

const meta: Meta<typeof GoalLoopCard> = {
  title: "DesignSystem/GoalLoopCard",
  component: GoalLoopCard,
  args: {
    state: "working",
    stateLabel: "Pracuje",
    title: "Pokrytí testy jádra na 80 %",
    used: 7,
    max: 12,
    ringCaption: "z 12 iterací",
    ringAriaLabel: "7 z 12 iterací",
    budgetLabel: "58 % rozpočtu iterací",
    maker: { name: "Kodér", role: "Maker" },
    verifier: { name: "Tester", role: "Verifier" },
    verdict: { head: "Verdikt · iterace 7", status: "Neprošlo", text: "Pokrytí 74 %" },
  },
};
export default meta;
export const Working: StoryObj<typeof GoalLoopCard> = {};
