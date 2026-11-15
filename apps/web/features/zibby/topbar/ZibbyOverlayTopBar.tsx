"use client";

import { Button, ZibbyIconButton, ZibbyTopBar, ZibbyTopBarMenu } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ZibbyConversations } from "../conversations";

export enum ZibbyOverlayTopBarTestId {
  New = "zibby-overlay-top-bar-new",
  Close = "zibby-overlay-top-bar-close",
}

export interface ZibbyOverlayTopBarProps {
  conversations: ZibbyConversations;
  /** The active conversation has no messages — "Clear" has nothing to clear. */
  threadEmpty: boolean;
  historyOpen: boolean;
  onHistoryToggle: () => void;
  /** Id of the history panel (`aria-controls`). */
  historyControls?: string;
  onClose: () => void;
  /** Phone: icon-only actions. */
  compact: boolean;
}

/**
 * The overlay's top bar: history toggle (⌥ H), the active conversation's title (click to
 * rename), "New conversation", the ⋯ menu (Rename · Clear and start over · Delete) and close.
 * Actions the conversations hook treats as no-ops while a turn is in flight are disabled.
 */
export function ZibbyOverlayTopBar({
  conversations,
  threadEmpty,
  historyOpen,
  onHistoryToggle,
  historyControls,
  onClose,
  compact,
}: ZibbyOverlayTopBarProps) {
  const t = useTranslations("zibby");
  const [renaming, setRenaming] = useState(false);
  const { activeId, busy } = conversations;

  return (
    <ZibbyTopBar
      actions={
        <>
          <Button
            aria-label={compact ? t("topBar.new") : undefined}
            data-testid={ZibbyOverlayTopBarTestId.New}
            disabled={busy}
            icon="plus"
            intent="ghost"
            onClick={conversations.startNew}
            size="sm"
          >
            {compact ? null : t("topBar.new")}
          </Button>
          <ZibbyTopBarMenu
            items={[
              {
                id: "rename",
                label: t("topBar.rename"),
                icon: "pen",
                disabled: activeId === null,
                onSelect: () => setRenaming(true),
              },
              {
                id: "clear",
                label: t("topBar.clear"),
                icon: "retry",
                disabled: threadEmpty || busy,
                onSelect: conversations.clearActive,
              },
              {
                id: "delete",
                label: t("topBar.delete"),
                icon: "trash",
                danger: true,
                disabled: activeId === null || busy,
                onSelect: () => {
                  if (activeId) conversations.remove(activeId);
                },
              },
            ]}
            label={t("topBar.menu")}
          />
          <ZibbyIconButton
            data-testid={ZibbyOverlayTopBarTestId.Close}
            icon="x"
            label={t("topBar.close")}
            onClick={onClose}
          />
        </>
      }
      historyControls={historyControls}
      historyKbd={compact ? undefined : t("topBar.historyKbd")}
      historyLabel={t("topBar.history")}
      historyOpen={historyOpen}
      onHistoryToggle={onHistoryToggle}
      onRename={activeId ? (next) => conversations.rename(activeId, next) : undefined}
      onRenamingChange={setRenaming}
      renameHint={t("topBar.titleHint")}
      renaming={renaming}
      title={conversations.activeTitle}
      titleInputLabel={t("topBar.titleInput")}
    />
  );
}
