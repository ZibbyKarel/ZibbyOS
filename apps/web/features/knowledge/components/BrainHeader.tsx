"use client";

import { useEffect, useRef } from "react";
import {
  Button,
  Container,
  Icon,
  Kbd,
  SearchInput,
  Stack,
  StatusDot,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import type { BrainSourceInfo } from "../hooks/useBrainData";

export enum BrainHeaderTestId {
  Search = "brain-search",
  Sources = "brain-sources-open",
  QuickCapture = "vault-quickcapture-toggle",
  NewNote = "vault-note-new",
  Import = "vault-import-open",
  UpdateAll = "brain-update-all",
}

export interface BrainHeaderProps {
  noteCount: number;
  sources: readonly BrainSourceInfo[];
  search: string;
  onSearch: (value: string) => void;
  /** Hit count while a search is active, else null. */
  hits: number | null;
  onOpenSources: () => void;
  onQuickCapture: () => void;
  onNewNote: () => void;
  onImport: () => void;
  onUpdateAll: () => void;
  updating: boolean;
}

/** Page head of Mozek: title + counts + source status, global search, capture / import / update. */
export function BrainHeader({
  noteCount,
  sources,
  search,
  onSearch,
  hits,
  onOpenSources,
  onQuickCapture,
  onNewNote,
  onImport,
  onUpdateAll,
  updating,
}: BrainHeaderProps) {
  const t = useTranslations("knowledge.brain.header");
  const tm = useTranslations("memory");
  const failed = sources.filter((s) => s.state === "failed").length;
  const search$ = useRef<HTMLInputElement>(null);

  // "/" jumps to the search field, unless the operator is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;
      e.preventDefault();
      search$.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Container padding={["150", "200"]}>
      <Stack wrap align="center" direction="row" gap="200">
        <Stack gap="25">
          <Typography type="title">{t("title")}</Typography>
          <Stack align="center" direction="row" gap="100">
            <Typography mono size="sm" type="note" variant="tertiary">
              {t("count", { notes: noteCount, sources: sources.length })}
            </Typography>
            <Button
              aria-label={failed > 0 ? t("sourcesFailed", { count: failed }) : t("sources")}
              data-testid={BrainHeaderTestId.Sources}
              intent="ghost"
              onClick={onOpenSources}
              size="sm"
            >
              <Stack align="center" direction="row" gap="50">
                {sources.map((s) => (
                  <StatusDot
                    key={s.id}
                    size="75"
                    tone={s.state === "failed" ? "bad" : s.state === "loading" ? "idle" : "ok"}
                  />
                ))}
                <Icon name="chevron" size="sm" tone="faint" />
              </Stack>
            </Button>
          </Stack>
        </Stack>

        <Container grow maxWidth="440px" minWidth="240px">
          <SearchInput
            ariaLabel={t("searchLabel")}
            count={hits ?? undefined}
            data-testid={BrainHeaderTestId.Search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            ref={search$}
            trailing={<Kbd>/</Kbd>}
            value={search}
          />
        </Container>

        <Container grow />

        <Stack wrap align="center" direction="row" gap="100">
          <Button
            data-testid={BrainHeaderTestId.QuickCapture}
            icon="bolt"
            intent="ghost"
            onClick={onQuickCapture}
            size="sm"
          >
            {tm("quickCapture.trigger")}
          </Button>
          <Button
            data-testid={BrainHeaderTestId.Import}
            icon="file"
            intent="ghost"
            onClick={onImport}
            size="sm"
          >
            {tm("import.trigger")}
          </Button>
          <Button
            data-testid={BrainHeaderTestId.NewNote}
            icon="plus"
            intent="ghost"
            onClick={onNewNote}
            size="sm"
          >
            {tm("newNote")}
          </Button>
          <Button
            data-testid={BrainHeaderTestId.UpdateAll}
            icon="retry"
            intent="ink"
            loading={updating}
            onClick={onUpdateAll}
            size="sm"
          >
            {updating ? t("updating") : t("updateAll")}
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
