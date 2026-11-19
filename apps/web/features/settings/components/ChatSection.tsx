"use client";

import {
  Container,
  IconTile,
  RadioCard,
  RadioCardGroup,
  SettingsPanel,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ChatPersona, SystemConfig } from "@zibby/contracts";
import { useSetSystemConfigMutation, useSystemConfigQuery } from "../../system";
import { useSettingsReadOnly } from "../draft/SettingsDraftProvider";

/** The personas offered, in display order. Labels/descriptions come from i18n. */
const PERSONAS: ChatPersona[] = ["jarvis", "concise", "formal"];

/**
 * The chat personality picker. ZIBBY's conversational *tone* is operator-selectable
 * (JARVIS-like butler by default); only the tone changes — the answer/ask/act
 * governor is constant. Persisted on the file-backed {@link SystemConfig}
 * (`chatPersona`) and read live by the chat engine, so a change applies to the next
 * conversation without a restart. A radio choice applies instantly; the whole config
 * document is PUT with the fresh server config spread in, so runtime knobs aren't clobbered.
 */
export function ChatSection() {
  const { data: config } = useSystemConfigQuery();
  if (!config) return null;
  return <ChatEditor config={config} key={config.chatPersona} />;
}

function ChatEditor({ config }: { config: SystemConfig }) {
  const t = useTranslations("settings");
  const setConfig = useSetSystemConfigMutation();
  const readOnly = useSettingsReadOnly();
  const [persona, setPersona] = useState<ChatPersona>(config.chatPersona);

  const choose = (next: ChatPersona) => {
    setPersona(next);
    setConfig.mutate({ body: { ...config, chatPersona: next } });
  };

  return (
    <SettingsPanel description={t("chat.panelHint")} id="persona" title={t("chat.title")}>
      <Container padding="200">
        <RadioCardGroup ariaLabel={t("chat.title")}>
          {PERSONAS.map((p) => (
            <RadioCard
              checked={persona === p}
              disabled={readOnly}
              hint={t(`chat.personaDesc.${p}`)}
              key={p}
              label={t(`chat.persona.${p}`)}
              media={<IconTile>{t(`chat.persona.${p}`).charAt(0)}</IconTile>}
              onSelect={() => choose(p)}
            />
          ))}
        </RadioCardGroup>
      </Container>
    </SettingsPanel>
  );
}
