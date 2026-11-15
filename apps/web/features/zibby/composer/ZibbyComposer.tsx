"use client";

import { CHAT_MODELS, type ChatModel, type TaskTarget } from "@zibby/contracts";
import {
  Button,
  Container,
  Dropdown,
  ZibbyComposerBar,
  ZibbyPttButton,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { type Ref, useState } from "react";
import { useTierLabel } from "../../ai-providers";
import {
  CommandLine,
  type CommandLineHandle,
  type ScopeKind,
} from "../../tasks/components/CommandLine/CommandLine";
import type { TaskAttachmentSet } from "../../tasks/components/TaskAttachments";
import type { ZibbyVoiceMode } from "../voice/useZibbyVoice";

export enum ZibbyComposerTestId {
  Send = "zibby-composer-send",
  ModelPicker = "zibby-composer-model",
  Ptt = "zibby-composer-ptt",
}

/** Composer auto-grows up to this many lines, then scrolls. */
const COMPOSER_MAX_ROWS = 6;

/** `#` offers every scope kind the chat send body carries. */
const CHAT_SCOPE_KINDS: readonly ScopeKind[] = ["project", "team", "company"];

export interface ZibbyComposerProps {
  /** Phone layout: the big round push-to-talk button. */
  compact: boolean;
  mode: ZibbyVoiceMode;
  /** The microphone is live. */
  listening: boolean;
  /** 0–1 live mic level (drives the PTT waveform). */
  level: number;
  /** Mode-aware talk start / end (`ZibbyVoice.pressTalk` / `releaseTalk`). */
  onPressTalk: () => void;
  onReleaseTalk: () => void;
  /** A turn is in flight — Enter / the send button wait for it, typing stays live. */
  thinking: boolean;
  model: ChatModel;
  onModelChange: (model: ChatModel) => void;
  onSend: (text: string, mentions?: TaskTarget[], attachments?: TaskAttachmentSet) => void;
  onScopeChange: (kind: ScopeKind, id: string | undefined) => void;
  onSkillChange: (skillId: string | undefined) => void;
  /** Text to append to the draft once (a voice utterance that could not be sent right away). */
  injectedText?: string;
  onInjectedTextConsumed: () => void;
  /** Files dropped anywhere on the page, to attach through the composer's own upload. */
  injectedFiles?: File[];
  onInjectedFilesConsumed: () => void;
  /** Imperative handle to send a spoken utterance together with the pending attachments. */
  handleRef: Ref<CommandLineHandle>;
}

/**
 * The overlay's composer bar: push-to-talk (hold in `ptt`, tap in `handsfree`; the big round
 * button on a phone) · the rich {@link CommandLine} (`@` mentions, `#` scope, `/` skills, attach,
 * model picker — configured exactly as the old dock did) · send. The PTT sits in a
 * `data-ptt-allow` wrapper so Space still talks while it holds focus after a click.
 */
export function ZibbyComposer({
  compact,
  mode,
  listening,
  level,
  onPressTalk,
  onReleaseTalk,
  thinking,
  model,
  onModelChange,
  onSend,
  onScopeChange,
  onSkillChange,
  injectedText,
  onInjectedTextConsumed,
  injectedFiles,
  onInjectedFilesConsumed,
  handleRef,
}: ZibbyComposerProps) {
  const t = useTranslations("zibby");
  const tChat = useTranslations("chat");
  const tierLabel = useTierLabel();
  const modelOptions = CHAT_MODELS.map((m) => ({ value: m, label: tierLabel(m) }));
  const [hasAttachments, setHasAttachments] = useState(false);
  const hold = mode === "ptt";

  const pttLabel = hold
    ? listening
      ? t("ptt.holdActive")
      : t("ptt.holdIdle")
    : listening
      ? t("ptt.tapActive")
      : t("ptt.tapIdle");

  // `data-zibby-autofocus`: the overlay focuses the PTT's wrapper (not the button) on open, so no
  // focus ring flashes on it while Space still talks (`data-ptt-allow`).
  return (
    <ZibbyComposerBar
      label={t("composer.label")}
      leading={
        <Container data-ptt-allow data-zibby-autofocus style={{ outline: "none" }} tabIndex={-1}>
          <ZibbyPttButton
            active={listening}
            data-testid={ZibbyComposerTestId.Ptt}
            label={hold ? t("ptt.holdAria") : t("ptt.tapAria")}
            level={level}
            mode={hold ? "hold" : "tap"}
            onTalkEnd={hold ? onReleaseTalk : onPressTalk}
            onTalkStart={onPressTalk}
            size={compact ? "lg" : "md"}
          >
            {pttLabel}
          </ZibbyPttButton>
        </Container>
      }
    >
      <CommandLine
        allowSkillMentions
        bareFrame
        frameless
        hideLabel
        inline
        multipleTargets
        showAttach
        attachIcon="paperclip"
        chrome={false}
        handleRef={handleRef}
        injectedFiles={injectedFiles}
        injectedText={injectedText}
        label={t("composer.label")}
        leadingActions={
          <Container data-testid={ZibbyComposerTestId.ModelPicker}>
            <Dropdown
              aria-label={tChat("composer.model")}
              onChange={onModelChange}
              options={modelOptions}
              size="sm"
              value={model}
              variant="inline"
            />
          </Container>
        }
        maxRows={COMPOSER_MAX_ROWS}
        onAttachmentsChange={(set) => setHasAttachments(set.files.length > 0)}
        onInjectedFilesConsumed={onInjectedFilesConsumed}
        onInjectedTextConsumed={onInjectedTextConsumed}
        onScopeChange={onScopeChange}
        onSkillChange={onSkillChange}
        onSubmit={(text, _target, attachments, mentions) => onSend(text, mentions, attachments)}
        placeholder={hasAttachments ? t("composer.placeholderAttached") : t("composer.placeholder")}
        renderTrailing={({ submit }) => (
          // Always filled per the design — an empty draft is ignored by `submit` itself, so the
          // button only greys out while a turn is in flight.
          <Button
            aria-label={thinking ? t("composer.sendBusy") : t("composer.send")}
            data-testid={ZibbyComposerTestId.Send}
            disabled={thinking}
            icon="arrow"
            intent="primary"
            onClick={submit}
            size="sm"
          />
        )}
        scopeKinds={CHAT_SCOPE_KINDS}
        submitDisabled={thinking}
      />
    </ZibbyComposerBar>
  );
}
