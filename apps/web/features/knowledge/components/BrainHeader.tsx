"use client";

import { Button, Container, SearchInput, Stack, StatusDot, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import type { BrainSourceInfo } from "../hooks/useBrainData";

export enum BrainHeaderTestId {
  Search = "brain-search",
  Sources = "brain-sources-open",
  QuickCapture = "vault-quickcapture-toggle",
  NewNote = "vault-note-new",
  Import = "vault-import-open",
  UpdateAll = "brain-update-all",
  Pending = "brain-pending",
}

export interface BrainHeaderProps {
  noteCount: number;
  sources: readonly BrainSourceInfo[];
  search: string;
  onSearch: (value: string) => void;
  /** Hit count while a search is active, else null. */
  hits: number | null;
  /** Open questions waiting for the operator (Údržba badge). */
  pending: number;
  onOpenSources: () => void;
  onQuickCapture: () => void;
  onNewNote: () => void;
  onImport: () => void;
  onUpdateAll: () => void;
  onOpenMaintenance: () => void;
  updating: boolean;
}

/** Page head of Mozek: title + counts + source status, global search, capture / import / update. */
export function BrainHeader({
  noteCount,
  sources,
  search,
  onSearch,
  hits,
  pending,
  onOpenSources,
  onQuickCapture,
  onNewNote,
  onImport,
  onUpdateAll,
  onOpenMaintenance,
  updating,
}: BrainHeaderProps) {
  const t = useTranslations("knowledge.brain.header");
  const tm = useTranslations("memory");
  const failed = sources.filter((s) => s.state === "failed").length;

  return (
    <Container padding={["150", "200"]}>
      <Stack wrap align="center" direction="row" gap="200" justify="between">
        <Stack gap="25">
          <Typography type="title">{t("title")}</Typography>
          <Stack align="center" direction="row" gap="100">
            <Typography size="sm" type="note" variant="tertiary">
              {t("count", { notes: noteCount, sources: sources.length })}
            </Typography>
            <Button
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
                {failed > 0 ? t("sourcesFailed", { count: failed }) : t("sources")}
              </Stack>
            </Button>
          </Stack>
        </Stack>

        <Container grow maxWidth="440px" minWidth="200px">
          <SearchInput
            ariaLabel={t("searchLabel")}
            count={hits ?? undefined}
            data-testid={BrainHeaderTestId.Search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
        </Container>

        <Stack wrap align="center" direction="row" gap="100">
          {pending > 0 && (
            <Button
              data-testid={BrainHeaderTestId.Pending}
              intent="ghost"
              onClick={onOpenMaintenance}
              size="sm"
            >
              {t("pending", { count: pending })}
            </Button>
          )}
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
            intent="secondary"
            onClick={onNewNote}
            size="sm"
          >
            {tm("newNote")}
          </Button>
          <Button
            data-testid={BrainHeaderTestId.UpdateAll}
            icon="retry"
            intent="primary"
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
