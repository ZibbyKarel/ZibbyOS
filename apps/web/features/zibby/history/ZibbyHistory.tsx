"use client";

import { ZibbyHistoryPanel } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ZibbyConversations } from "../conversations";

export interface ZibbyHistoryProps {
  conversations: ZibbyConversations;
  onClose: () => void;
}

/**
 * The overlay's left history panel wired to {@link ZibbyConversations}: grouped (Today /
 * Yesterday / This week / Older), full-text search with highlighting, open, rename (pen or
 * double-click), delete (soft, with the undo toast) and "New conversation". Opening another
 * conversation or deleting the active one is ignored while a turn is in flight.
 */
export function ZibbyHistory({ conversations, onClose }: ZibbyHistoryProps) {
  const t = useTranslations("zibby");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const { busy, activeId, query } = conversations;

  return (
    <ZibbyHistoryPanel
      clearSearchLabel={t("history.clearSearch")}
      closeLabel={t("history.close")}
      count={conversations.count}
      deleteLabel={(title) => t("history.delete", { title })}
      emptyLabel={query.trim() ? t("history.noMatch", { query: query.trim() }) : t("history.empty")}
      footer={t("history.footer")}
      groups={conversations.groups}
      newLabel={t("history.new")}
      onClose={onClose}
      onDelete={(id) => {
        if (busy && id === activeId) return;
        conversations.remove(id);
      }}
      onNew={() => {
        if (!busy) conversations.startNew();
      }}
      onOpen={(id) => {
        if (!busy) conversations.open(id);
      }}
      onQueryChange={conversations.setQuery}
      onRename={conversations.rename}
      onRenamingIdChange={setRenamingId}
      query={query}
      renameInputLabel={t("history.renameInput")}
      renameLabel={(title) => t("history.rename", { title })}
      renamingId={renamingId}
      searchLabel={t("history.searchLabel")}
      searchPlaceholder={t("history.searchPlaceholder")}
      title={t("history.title")}
    />
  );
}
