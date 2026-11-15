import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button/Button";
import { ZibbyPttButton } from "../ZibbyPttButton/ZibbyPttButton";
import { ZibbyComposerBar, ZibbyComposerInput } from "./ZibbyComposerBar";

const meta: Meta<typeof ZibbyComposerBar> = {
  title: "DesignSystem/ZibbyComposerBar",
  component: ZibbyComposerBar,
};
export default meta;

type Story = StoryObj<typeof ZibbyComposerBar>;

const send = <Button aria-label="Odeslat" icon="arrow" size="sm" />;
const ptt = <ZibbyPttButton label="Drž a mluv">Drž a mluv</ZibbyPttButton>;

export const Overview: Story = {
  render: () => (
    <div className="flex w-[640px] flex-col gap-6 text-ink">
      <ZibbyComposerBar leading={ptt} trailing={send}>
        <ZibbyComposerInput aria-label="Napsat Zibbymu" placeholder="nebo napiš…" />
      </ZibbyComposerBar>
      <ZibbyComposerBar leading={ptt} trailing={send}>
        <textarea
          aria-label="Víceřádkový editor"
          className="block w-full resize-none bg-transparent py-2 text-[14px] text-ink outline-none"
          defaultValue={"První řádek\nDruhý řádek\nTřetí řádek"}
          rows={3}
        />
      </ZibbyComposerBar>
      <ZibbyComposerBar>
        <ZibbyComposerInput aria-label="Jen vstup" placeholder="Bez slotů…" />
      </ZibbyComposerBar>
    </div>
  ),
};

export const Playground: Story = {
  args: { label: "Composer" },
  render: (args) => (
    <div className="w-[640px] text-ink">
      <ZibbyComposerBar {...args} leading={ptt} trailing={send}>
        <ZibbyComposerInput aria-label="Napsat Zibbymu" placeholder="nebo napiš…" />
      </ZibbyComposerBar>
    </div>
  ),
};
