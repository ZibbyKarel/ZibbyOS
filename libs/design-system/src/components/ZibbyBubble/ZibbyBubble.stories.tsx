import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import { ZibbyAttachmentChip } from "../ZibbyAttachmentChip/ZibbyAttachmentChip";
import { ZibbyAttachmentRow } from "../ZibbyAttachmentRow/ZibbyAttachmentRow";
import { ZibbyOrb } from "../ZibbyOrb/ZibbyOrb";
import { ZibbyBubble } from "./ZibbyBubble";

const meta: Meta<typeof ZibbyBubble> = {
  title: "DesignSystem/ZibbyBubble",
  component: ZibbyBubble,
  argTypes: { author: { control: "inline-radio", options: ["me", "zibby"] } },
};
export default meta;

type Story = StoryObj<typeof ZibbyBubble>;

const actions = (
  <>
    <Button icon="play" intent="ghost" size="sm">
      Přečíst nahlas
    </Button>
    <Button icon="plus" intent="ghost" size="sm">
      Vytvořit úkol
    </Button>
  </>
);

export const Overview: Story = {
  render: () => (
    <div className="flex w-[640px] flex-col gap-4 text-ink">
      <ZibbyBubble
        author="me"
        meta={
          <>
            <Icon name="mic" size="xs" />
            přepis · 17:33
          </>
        }
      >
        Jak dopadl poslední build pipeline-8815?
      </ZibbyBubble>
      <ZibbyBubble
        attachments={
          <ZibbyAttachmentRow align="end">
            <ZibbyAttachmentChip kind="code" name="pipeline-8815.log" sizeLabel="47 kB" />
          </ZibbyAttachmentRow>
        }
        author="me"
        meta="napsáno · 17:34"
        onEdit={() => {}}
      >
        Klikni a oprav (editovatelná zpráva)
      </ZibbyBubble>
      <ZibbyBubble actions={actions} author="zibby" avatar={<ZibbyOrb size={28} />}>
        Spadl na testu <code>api/chat</code>. Připravil jsem opravu a otevřel PR.
      </ZibbyBubble>
      <ZibbyBubble
        streaming
        author="zibby"
        avatar={<ZibbyOrb size={28} state="speak" />}
        cards={<div className="rounded-xl border border-line-2 bg-panel p-3 text-sm">Karta</div>}
      >
        Právě píšu
      </ZibbyBubble>
      <ZibbyBubble author="me">
        Superdlouhéslovobezmezerypronechytrésalamandrypronechytrésalamandrypronechytrésalamandrypronechytrésalamandry
      </ZibbyBubble>
    </div>
  ),
};

export const Playground: Story = {
  args: { author: "zibby", children: "Ahoj, jak ti mohu pomoct?", streaming: false },
  render: (args) => (
    <div className="w-[560px] text-ink">
      <ZibbyBubble
        {...args}
        avatar={args.author === "zibby" ? <ZibbyOrb size={28} /> : undefined}
      />
    </div>
  ),
};
