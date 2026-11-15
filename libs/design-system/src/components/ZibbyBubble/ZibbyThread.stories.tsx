import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DesignSystemProvider } from "../../DesignSystemContext/DesignSystemProvider";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import { Kbd } from "../Kbd/Kbd";
import { ZibbyAttachmentChip } from "../ZibbyAttachmentChip/ZibbyAttachmentChip";
import { ZibbyAttachmentRow } from "../ZibbyAttachmentRow/ZibbyAttachmentRow";
import { ZibbyComposerBar, ZibbyComposerInput } from "../ZibbyComposerBar/ZibbyComposerBar";
import { ZibbyFooter } from "../ZibbyFooter/ZibbyFooter";
import { ZibbyOrb } from "../ZibbyOrb/ZibbyOrb";
import { ZibbyPttButton } from "../ZibbyPttButton/ZibbyPttButton";
import { ZibbySuggestions } from "../ZibbySuggestions/ZibbySuggestions";
import { ZibbyBubble } from "./ZibbyBubble";

const meta: Meta = { title: "DesignSystem/Zibby thread" };
export default meta;

type Story = StoryObj;

function Thread() {
  const [talking, setTalking] = useState(false);
  return (
    <div className="flex w-[760px] flex-col gap-4 bg-background p-6 text-ink">
      <div className="flex flex-col gap-4 py-2">
        <ZibbyBubble
          author="me"
          meta={
            <>
              <Icon name="mic" size="xs" />
              přepis · 17:33
            </>
          }
          onEdit={() => {}}
        >
          Jak dopadl poslední build, co jsem ti posílal?
        </ZibbyBubble>
        <ZibbyBubble
          attachments={
            <ZibbyAttachmentRow align="end">
              <ZibbyAttachmentChip kind="code" name="pipeline-8815.log" sizeLabel="47 kB" />
              <ZibbyAttachmentChip kind="pdf" name="zadani.pdf" sizeLabel="320 kB" />
            </ZibbyAttachmentRow>
          }
          author="me"
          meta="napsáno · 17:34"
        >
          Tady je log, mrkni na to prosím.
        </ZibbyBubble>
        <ZibbyBubble
          streaming
          actions={
            <>
              <Button icon="play" intent="ghost" size="sm">
                Přečíst nahlas
              </Button>
              <Button icon="plus" intent="ghost" size="sm">
                Vytvořit úkol
              </Button>
            </>
          }
          author="zibby"
          avatar={<ZibbyOrb size={28} state="speak" />}
          cards={
            <div className="overflow-hidden rounded-xl border border-line-2 bg-panel text-[13.5px]">
              <div className="px-3 py-2">pipeline-8815 · selhal na testu api/chat</div>
              <div className="border-t border-line px-3 py-2 text-ink-3">
                PR #412 čeká na review
              </div>
            </div>
          }
        >
          Build spadl na jednom testu v <code>api/chat</code>. Opravu už mám připravenou a otevřel
          jsem PR, teď dopisuju shrnutí
        </ZibbyBubble>
      </div>
      <ZibbySuggestions
        items={[
          { label: "„Co je nového?“", onSelect: () => {} },
          {
            label: "pipeline-8815.log",
            onSelect: () => {},
            icon: "paperclip",
            lead: "nebo přilož:",
          },
        ]}
        lead="Zkus říct:"
      />
      <ZibbyAttachmentRow>
        <ZibbyAttachmentChip
          kind="code"
          name="pipeline-8815.log"
          onRemove={() => {}}
          sizeLabel="47 kB"
        />
      </ZibbyAttachmentRow>
      <ZibbyComposerBar
        leading={
          <ZibbyPttButton
            active={talking}
            label="Drž a mluv"
            onTalkEnd={() => setTalking(false)}
            onTalkStart={() => setTalking(true)}
          >
            {talking ? (
              "Pusť a odešle se"
            ) : (
              <>
                Drž <Kbd>Space</Kbd> a mluv
              </>
            )}
          </ZibbyPttButton>
        }
        trailing={<Button aria-label="Odeslat" icon="arrow" size="sm" />}
      >
        <ZibbyComposerInput aria-label="Napsat Zibbymu" placeholder="nebo napiš…" />
      </ZibbyComposerBar>
      <ZibbyFooter
        end="Esc zavře · ⌥ Space vyvolá · soubory přetáhni kamkoli"
        start={
          <Button intent="ghost" size="sm">
            Hlas zapnutý
          </Button>
        }
      />
    </div>
  );
}

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <DesignSystemProvider theme="dark">
        <Thread />
      </DesignSystemProvider>
      <DesignSystemProvider theme="light">
        <Thread />
      </DesignSystemProvider>
    </div>
  ),
};

export const Playground: Story = {
  render: () => <Thread />,
};
