"use client";

import { useMemo } from "react";
import { Button, Chip, Container, Pressable, Stack, Tag, Typography } from "@zibby/design-system";
import type { Note } from "@zibby/contracts";
import { useLocale, useTranslations } from "next-intl";
import { QueryError } from "../../../components/LoadError/QueryError";
import { QueryLoading } from "../../../components/LoadingState/QueryLoading";
import {
  type BrainGraphData,
  VAULT_SOURCE_ID,
  brainId,
  isStructural,
  parseBrainId,
  resolveWikilink,
} from "../brainModel";
import type { OpenQuestion } from "../hooks/useBrainData";
import { useNoteQuery, useTeamKbNoteQuery } from "../queries";
import { KbInboxCompose } from "./KbInboxCompose";
import { NoteNeighbourhood } from "./NoteNeighbourhood";
import { NoteView } from "./NoteView";
import { SourceShape } from "./SourceShape";

export enum NotePaneTestId {
  Empty = "brain-note-empty",
  OpenQuestions = "brain-note-open-questions",
}

export interface NotePaneProps {
  /** Unified id of the open note, or null. */
  selectedId: string | null;
  /** The whole (unfiltered) graph — `[[` suggestions and KB backlinks come from it. */
  graph: BrainGraphData;
  openQuestions: readonly OpenQuestion[];
  onSelect: (id: string) => void;
  /** Close the open note (✕ in the reader's top row). */
  onClose?: () => void;
  /** CSS colour / display name per source id (badge, link markers, neighbourhood card). */
  sourceColor: (sourceId: string) => string;
  sourceName: (sourceId: string) => string;
}

/**
 * The note zone of Mozek. A vault note is read and edited in place (`NoteView`); a team KB note is
 * read-only with backlinks derived from the graph, its open questions, and a compose-to-inbox box.
 */
export function NotePane({
  selectedId,
  graph,
  openQuestions,
  onSelect,
  onClose,
  sourceColor,
  sourceName,
}: NotePaneProps) {
  const t = useTranslations("knowledge.brain.note");
  const tm = useTranslations("memory");
  const locale = useLocale();
  const parsed = selectedId ? parseBrainId(selectedId) : null;
  const isVault = parsed?.sourceId === VAULT_SOURCE_ID;
  const teamId = parsed && !isVault ? parsed.sourceId : null;

  const vaultNote = useNoteQuery(isVault ? parsed.localId : null);
  const kbNote = useTeamKbNoteQuery(teamId, teamId ? (parsed?.localId ?? null) : null);

  const vaultTargets = useMemo(
    () =>
      graph.nodes
        .filter((n) => n.sourceId === VAULT_SOURCE_ID)
        .map((n) => ({ id: n.localId, label: n.label })),
    [graph.nodes],
  );

  const kbView: Note | undefined = useMemo(() => {
    const data = kbNote.data;
    if (!data || !teamId) return undefined;
    const ids = graph.nodes.filter((n) => n.sourceId === teamId).map((n) => n.localId);
    const links = [
      ...new Set(
        data.links.flatMap((l) => {
          const id = resolveWikilink(l, ids);
          return id && id !== data.id ? [id] : [];
        }),
      ),
    ];
    const self = brainId(teamId, data.id);
    const backlinks = graph.edges
      .filter((e) => e.to === self && e.from.startsWith(`${teamId}:`))
      .map((e) => e.from.slice(teamId.length + 1));
    return {
      id: data.id,
      path: data.id,
      tier: "knowledge",
      title: data.title,
      frontmatter: {},
      links,
      backlinks,
      body: data.body,
    };
  }, [kbNote.data, graph, teamId]);

  const labelOf = (sourceId: string) => (local: string) =>
    graph.nodes.find((n) => n.id === brainId(sourceId, local))?.label ?? local;
  const markerEl = (sourceId: string) => (
    <SourceShape
      color={sourceColor(sourceId)}
      shape={sourceId === VAULT_SOURCE_ID ? "vault" : "kb"}
    />
  );

  /** Source badge, breadcrumb path and the copy-path tool of the bare note header. */
  const chrome = (sourceId: string, path: string | undefined, metaChips: string[]) => ({
    badge: (
      <Tag size="sm" tone={sourceId === VAULT_SOURCE_ID ? "working" : "done"}>
        {sourceName(sourceId)}
      </Tag>
    ),
    crumbs: path
      ? `${sourceName(sourceId)} / ${path.replace(/\.md$/, "").split("/").join(" / ")}.md`
      : undefined,
    metaChips: metaChips.filter(Boolean),
    headerTools: path ? (
      <Button
        aria-label={t("copyPath")}
        icon="copy"
        intent="ghost"
        onClick={() => void navigator.clipboard?.writeText(path)}
        size="sm"
      />
    ) : undefined,
  });
  const place = (n: Note) => {
    const tier = tm(`tier.${n.tier}`);
    return n.department ? `${tier} › ${n.department}` : tier;
  };
  /** "upraveno <date>" from the note's own frontmatter (the API carries no file mtime). */
  const updatedChip = (n: Note) => {
    const raw = n.frontmatter.updated ?? n.frontmatter.modified;
    const ms = typeof raw === "string" || typeof raw === "number" ? Date.parse(String(raw)) : NaN;
    return Number.isNaN(ms) ? "" : t("updated", { date: new Date(ms).toLocaleDateString(locale) });
  };
  const hood = (sourceId: string, n: Note) => {
    const ids = [...new Set([...(n.backlinks ?? []), ...n.links])];
    const label = labelOf(sourceId);
    return (
      <NoteNeighbourhood
        center={{ id: brainId(sourceId, n.id), label: n.title, color: sourceColor(sourceId) }}
        neighbours={ids.map((l) => ({
          id: brainId(sourceId, l),
          label: label(l),
          color: sourceColor(sourceId),
        }))}
        onSelect={onSelect}
        title={t("neighbourhood")}
      />
    );
  };

  // empty state: the best-connected notes are the way in (the graph carries no edit times)
  const top = useMemo(() => {
    const deg = new Map<string, number>();
    for (const e of graph.edges) {
      if (isStructural(e.from) || isStructural(e.to)) continue;
      deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
      deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
    }
    return graph.nodes
      .filter((n) => !n.hub)
      .sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0) || a.label.localeCompare(b.label))
      .slice(0, 6);
  }, [graph]);

  if (!parsed)
    return (
      <Container data-testid={NotePaneTestId.Empty} padding="250">
        <Container height="20dvh" />
        <Stack align="center" gap="100">
          <svg
            aria-hidden="true"
            fill="none"
            height="26"
            stroke="var(--color-foreground-faint)"
            strokeWidth="1.6"
            viewBox="0 0 24 24"
            width="26"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" fill="var(--color-foreground-faint)" r="2.2" stroke="none" />
          </svg>
          <Typography type="title">{t("emptyTitle")}</Typography>
          <Container maxWidth="320px">
            <Typography align="center" size="sm" type="note" variant="secondary">
              {t("emptyHint")}
            </Typography>
          </Container>
          {top.length > 0 && (
            <Container maxWidth="340px" padding={["200", "0"]} width="100%">
              <Stack gap="75">
                <Typography uppercase size="2xs" type="note" variant="tertiary">
                  {t("popular")}
                </Typography>
                {top.map((n) => (
                  <Pressable key={n.id} onClick={() => onSelect(n.id)}>
                    <Stack align="center" direction="row" gap="75" justify="between">
                      <Stack align="center" direction="row" gap="75">
                        <SourceShape
                          color={sourceColor(n.sourceId)}
                          shape={n.sourceId === VAULT_SOURCE_ID ? "vault" : "kb"}
                        />
                        <Typography size="sm" type="note" variant="secondary">
                          {n.label}
                        </Typography>
                      </Stack>
                      <Typography mono size="2xs" type="note" variant="tertiary">
                        {sourceName(n.sourceId)}
                      </Typography>
                    </Stack>
                  </Pressable>
                ))}
              </Stack>
            </Container>
          )}
        </Stack>
      </Container>
    );

  if (isVault) {
    if (vaultNote.isPending) return <QueryLoading />;
    if (vaultNote.isError) return <QueryError onRetry={() => void vaultNote.refetch()} />;
    const n = vaultNote.data;
    return (
      <NoteView
        bare
        {...chrome(
          VAULT_SOURCE_ID,
          n?.path,
          n ? [place(n), ...(n.tags ?? []).map((x) => `#${x}`), updatedChip(n)] : [],
        )}
        linkLabel={labelOf(VAULT_SOURCE_ID)}
        linkMarker={() => markerEl(VAULT_SOURCE_ID)}
        neighbourhood={n ? hood(VAULT_SOURCE_ID, n) : undefined}
        note={n}
        onClose={onClose}
        onSelect={(local) => onSelect(brainId(VAULT_SOURCE_ID, local))}
        wikilinkTargets={vaultTargets}
      />
    );
  }

  if (kbNote.isPending) return <QueryLoading />;
  if (kbNote.isError) return <QueryError onRetry={() => void kbNote.refetch()} />;
  const questions = openQuestions.filter((q) => q.teamId === teamId && q.noteId === parsed.localId);
  return (
    <NoteView
      bare
      readOnly
      {...chrome(
        teamId ?? "",
        kbView?.path,
        kbView ? [kbView.path.split("/").slice(0, -1).join("/") || "/"] : [],
      )}
      extra={
        <Stack gap="150">
          {questions.length > 0 && (
            <Stack data-testid={NotePaneTestId.OpenQuestions} gap="50">
              <Typography uppercase size="2xs" type="note" variant="tertiary">
                {t("openQuestions")}
              </Typography>
              {questions.map((q) => (
                <Chip dot key={q.text} tone="wait">
                  {q.text}
                </Chip>
              ))}
            </Stack>
          )}
          {teamId && <KbInboxCompose teamId={teamId} />}
        </Stack>
      }
      linkLabel={labelOf(teamId ?? "")}
      linkMarker={() => markerEl(teamId ?? "")}
      neighbourhood={kbView ? hood(teamId ?? "", kbView) : undefined}
      note={kbView}
      onClose={onClose}
      onSelect={(local) => onSelect(brainId(teamId ?? "", local))}
    />
  );
}
