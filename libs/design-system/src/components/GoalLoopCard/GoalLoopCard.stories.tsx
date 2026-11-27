import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button/Button";
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
    topMeta: "58 % rozpočtu iterací",
    parties: [
      { name: "Kodér", role: "Maker" },
      { name: "Tester", role: "Verifier" },
    ],
    partySeparator: "⇄",
    verdict: { head: "Verdikt · iterace 7", status: "Neprošlo", text: "Pokrytí 74 %" },
    selected: false,
    size: "full",
  },
  argTypes: { size: { control: "radio", options: ["full", "compact"] } },
};
export default meta;
type Story = StoryObj<typeof GoalLoopCard>;

export const Overview: Story = {
  render: () => (
    <div className="grid max-w-[900px] grid-cols-2 gap-4">
      <GoalLoopCard
        actions={
          <>
            <Button icon="play" size="sm">
              Pokračovat
            </Button>
            <Button intent="ghost" size="sm">
              Upravit cíl
            </Button>
          </>
        }
        max={10}
        parties={[
          { name: "Kodér", role: "Maker" },
          { name: "Analytik", role: "Verifier" },
        ]}
        partySeparator="⇄"
        ringAriaLabel="9 z 10 iterací"
        ringCaption="z 10 iterací"
        state="blocked"
        stateLabel="Čeká na tebe"
        title="Lighthouse ≥ 95 na landing page"
        topMeta="90 % rozpočtu iterací"
        used={9}
        verdict={{ head: "Verdikt · iterace 9", status: "Čeká", text: "LCP 2,9 s blokuje." }}
        verdictTone="blocked"
      />
      <GoalLoopCard
        selected
        max={3}
        parties={[
          { name: "Všechny projekty", role: "Rozsah", avatar: false },
          { name: "tier2 · Jednat a hlásit", role: "Strop", avatar: false },
        ]}
        ringAriaLabel="3 z 3 projektů"
        ringCaption="z 3 projektů"
        state="done"
        stateLabel="Hotovo"
        title="Moje PR jsou merge-ready"
        topMeta="Každý pracovní den v 09:00"
        used={3}
        verdict={{ head: "Poslední krok · 27. 11. 9:12", text: "Všechny PR zelené." }}
        verdictTone="done"
      />
      <GoalLoopCard
        max={1}
        ringAriaLabel="zatím neběžel"
        ringCaption="zatím neběžel"
        ringValue="–"
        state="idle"
        stateLabel="Pozastaveno"
        title="Týdenní úklid mozku"
        used={0}
      />
      <GoalLoopCard
        max={4}
        ringAriaLabel="1 z 4"
        size="compact"
        state="working"
        stateLabel="Pracuje"
        title="Závislosti aktuální ve všech projektech"
        used={1}
        verdict={{ head: "Poslední krok", text: "Otevřel PR #42 s aktualizací závislostí." }}
      />
    </div>
  ),
};

export const Playground: Story = {};
