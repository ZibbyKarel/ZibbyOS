import type { Meta, StoryObj } from "@storybook/react";
import { BoardText } from "../BoardText/BoardText";
import { Button } from "../Button/Button";
import { DecisionCard } from "./DecisionCard";

const meta: Meta<typeof DecisionCard> = {
  title: "DesignSystem/DecisionCard",
  component: DecisionCard,
  args: {
    context: "Automatizace · CI triage · před 40 min",
    title: <BoardText kind="cardTitle">Spouštět noční CI triage i pro partner-cli</BoardText>,
    children: (
      <BoardText kind="reading">
        Develop padá třetí den po sobě. Triage by běžel ve 02:00 a ráno by čekal souhrn příčin.
      </BoardText>
    ),
    actions: (
      <>
        <Button size="sm">Schválit</Button>
        <Button intent="secondary" size="sm">
          Zamítnout
        </Button>
        <Button intent="ghost" size="sm">
          Upravit
        </Button>
      </>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof DecisionCard>;

export const Overview: Story = {};
export const Playground: Story = {};
