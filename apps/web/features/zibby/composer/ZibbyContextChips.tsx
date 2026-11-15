"use client";

import type { ChatAbout, TaskTarget } from "@zibby/contracts";
import { Chip } from "@zibby/design-system";
import { useTranslations } from "next-intl";

export enum ZibbyContextChipsTestId {
  TargetChip = "zibby-context-target-chip",
  AboutChip = "zibby-context-about-chip",
}

export interface ZibbyContextChipsProps {
  /** The dock-level explicit routing target (O-20), if any. */
  target: TaskTarget | null;
  onClearTarget: () => void;
  /** What the thread is about (todo-29), if anything. */
  about: ChatAbout | null;
  onClearAbout: () => void;
}

function targetLabel(target: TaskTarget): string {
  if (target.name) return target.name;
  return "id" in target ? target.id : target.kind;
}

/**
 * The two sticky context chips above the composer. No chip for the automatic default (O-20) —
 * the classifier routing is the obvious fallback with nothing to disambiguate; only an explicit
 * department target (clearable back to automatic) and an "about" context earn one. Renders
 * nothing when neither is set.
 */
export function ZibbyContextChips({
  target,
  onClearTarget,
  about,
  onClearAbout,
}: ZibbyContextChipsProps) {
  const t = useTranslations("chat");
  if (!target && !about) return null;
  return (
    <>
      {about && (
        <Chip
          closable
          closeLabel={t("dock.clearAbout")}
          data-testid={ZibbyContextChipsTestId.AboutChip}
          onClose={onClearAbout}
          tone="working"
        >
          {t("dock.aboutChip", { label: about.label })}
        </Chip>
      )}
      {target && (
        <Chip
          closable
          closeLabel={t("dock.clearTarget")}
          data-testid={ZibbyContextChipsTestId.TargetChip}
          onClose={onClearTarget}
          tone="thinking"
        >
          {t("dock.targetExplicit", { name: targetLabel(target) })}
        </Chip>
      )}
    </>
  );
}
