"use client";

import { useMemo } from "react";
import { Chip, Container, Stack, Typography } from "@zibby/design-system";
import type { Note } from "@zibby/contracts";
import { useTranslations } from "next-intl";
import { QueryError } from "../../../components/LoadError/QueryError";
import { QueryLoading } from "../../../components/LoadingState/QueryLoading";
import {
  type BrainGraphData,
  VAULT_SOURCE_ID,
  brainId,
  parseBrainId,
  resolveWikilink,
} from "../brainModel";
import type { OpenQuestion } from "../hooks/useBrainData";
import { useNoteQuery, useTeamKbNoteQuery } from "../queries";
import { KbInboxCompose } from "./KbInboxCompose";
import { NoteView } from "./NoteView";

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
}

/**
 * The note zone of Mozek. A vault note is read and edited in place (`NoteView`); a team KB note is
 * read-only with backlinks derived from the graph, its open questions, and a compose-to-inbox box.
 */
export function NotePane({ selectedId, graph, openQuestions, onSelect }: NotePaneProps) {
  const t = useTranslations("knowledge.brain.note");
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

  if (!parsed)
    return (
      <Container padding="250">
        <Typography
          mono
          data-testid={NotePaneTestId.Empty}
          size="sm"
          type="note"
          variant="secondary"
        >
          {t("empty")}
        </Typography>
      </Container>
    );

  if (isVault) {
    if (vaultNote.isPending) return <QueryLoading />;
    if (vaultNote.isError) return <QueryError onRetry={() => void vaultNote.refetch()} />;
    return (
      <Container padding="250">
        <NoteView
          bare
          note={vaultNote.data}
          onSelect={(local) => onSelect(brainId(VAULT_SOURCE_ID, local))}
          wikilinkTargets={vaultTargets}
        />
      </Container>
    );
  }

  if (kbNote.isPending) return <QueryLoading />;
  if (kbNote.isError) return <QueryError onRetry={() => void kbNote.refetch()} />;
  const questions = openQuestions.filter((q) => q.teamId === teamId && q.noteId === parsed.localId);
  return (
    <Container padding="250">
      <NoteView
        bare
        readOnly
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
        note={kbView}
        onSelect={(local) => onSelect(brainId(teamId ?? "", local))}
      />
    </Container>
  );
}
