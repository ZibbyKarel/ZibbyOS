"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Container,
  Panel,
  Splitter,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Typography,
} from "@zibby/design-system";
import type { DepartmentId } from "@zibby/contracts";
import { useTranslations } from "next-intl";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "../../../components/EmptyState/EmptyState";
import { QueryLoading } from "../../../components/LoadingState/QueryLoading";
import { BrainFilters } from "../components/BrainFilters";
import { BrainGraph } from "../components/BrainGraph";
import { BrainHeader } from "../components/BrainHeader";
import { BrainTree } from "../components/BrainTree";
import { ImportDialog } from "../components/ImportDialog";
import { NoteEditorDialog } from "../components/NoteEditorDialog";
import { NotePane } from "../components/NotePane";
import { QuickCapture } from "../components/QuickCapture";
import { SourceDrawer } from "../components/SourceDrawer";
import { sourceColorFor } from "../components/SourceShape";
import { NO_FILTER, VAULT_SOURCE_ID, brainId, filterBrain, matchTitles } from "../brainModel";
import { useBrainData } from "../hooks/useBrainData";
import { useNarrowViewport } from "../hooks/useNarrowViewport";
import { useSyncAllSources } from "../hooks/useSyncAllSources";
import { useMemorySearchQuery } from "../queries";

export enum BrainScreenTestId {
  Root = "brain-screen",
  Empty = "brain-empty",
  Loading = "brain-loading",
  FailedBanner = "brain-failed-banner",
  GraphZone = "brain-zone-graph",
  TreeZone = "brain-zone-tree",
  NoteZone = "brain-zone-note",
  TreeSplitter = "brain-splitter-tree",
  NoteSplitter = "brain-splitter-note",
}

const TREE_W = { init: 260, min: 200, max: 480 };
const NOTE_W = { init: 460, min: 320, max: 800 };

type NarrowTab = "brain" | "notes" | "note";

/**
 * Mozek: the whole second brain on one page — graph, read-only tree and note pane over one
 * unified set of notes (the vault plus every team KB, fanned out client-side). Selecting in any
 * zone selects the same note (`?note=<source>:<id>`); the splitters between zones resize with
 * the mouse or the arrow keys. At ≤1100px the zones become tabs Mozek / Poznámky / Poznámka.
 */
export function BrainScreen() {
  const t = useTranslations("knowledge.brain");
  const tm = useTranslations("memory");
  const router = useRouter();
  const searchParams = useSearchParams();
  const narrow = useNarrowViewport();
  const selectedId = searchParams.get("note");

  const brain = useBrainData();
  const teamIds = useMemo(
    () => brain.sources.filter((s) => s.kind === "kb").map((s) => s.id),
    [brain.sources],
  );
  const sync = useSyncAllSources(teamIds);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(NO_FILTER);
  const [treeW, setTreeW] = useState(TREE_W.init);
  const [noteW, setNoteW] = useState(NOTE_W.init);
  const [tab, setTab] = useState<NarrowTab>("brain");
  const [drawer, setDrawer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [quickCapturing, setQuickCapturing] = useState(false);
  const [importing, setImporting] = useState(false);

  const sourceColor = useMemo(() => sourceColorFor(brain.sources), [brain.sources]);
  const sourceName = useCallback(
    (id: string) => brain.sources.find((s) => s.id === id)?.name ?? id,
    [brain.sources],
  );

  const select = useCallback(
    (id: string) => {
      router.replace(`/knowledge/brain?note=${encodeURIComponent(id)}` as Route, { scroll: false });
      setTab("note");
    },
    [router],
  );

  const filtered = useMemo(() => filterBrain(brain.graph, filter), [brain.graph, filter]);
  const { data: vaultHits } = useMemorySearchQuery(search);
  const matchIds = useMemo(() => {
    const titles = matchTitles(filtered, search);
    if (!titles) return null;
    const visible = new Set(filtered.nodes.map((n) => n.id));
    for (const h of vaultHits?.results ?? []) {
      const id = brainId(VAULT_SOURCE_ID, h.id);
      if (visible.has(id)) titles.add(id);
    }
    return titles;
  }, [filtered, search, vaultHits]);

  const departments = useMemo(
    () =>
      [
        ...new Set(
          brain.graph.nodes.flatMap((n) =>
            n.sourceId === VAULT_SOURCE_ID && n.department ? [n.department] : [],
          ),
        ),
      ] as DepartmentId[],
    [brain.graph.nodes],
  );
  const noteCount = brain.graph.nodes.filter((n) => !n.hub).length;
  const failedSources = brain.sources.filter((s) => s.state === "failed");

  const header = (
    <BrainHeader
      hits={matchIds ? matchIds.size : null}
      noteCount={noteCount}
      onImport={() => setImporting(true)}
      onNewNote={() => setCreating(true)}
      onOpenMaintenance={() => router.push("/knowledge/maintenance" as Route)}
      onOpenSources={() => setDrawer(true)}
      onQuickCapture={() => setQuickCapturing(true)}
      onSearch={setSearch}
      onUpdateAll={() => void sync.runAll()}
      pending={brain.openQuestions.length}
      search={search}
      sources={brain.sources}
      updating={sync.running}
    />
  );

  const overlays = (
    <>
      <SourceDrawer
        onClose={() => setDrawer(false)}
        onRetrySync={(id) => void sync.retry(id)}
        onUpdateAll={() => void sync.runAll()}
        open={drawer}
        running={sync.running}
        sourceColor={sourceColor}
        sources={brain.sources}
        sync={sync.state}
      />
      {creating && (
        <NoteEditorDialog
          onClose={() => setCreating(false)}
          onSaved={(id) => select(brainId(VAULT_SOURCE_ID, id))}
        />
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </>
  );

  let body;
  if (brain.isLoading)
    body = (
      <Container data-testid={BrainScreenTestId.Loading} padding="300">
        <Stack align="center" gap="100">
          <QueryLoading />
          <Typography mono size="sm" type="note" variant="tertiary">
            {t("indexing")}
          </Typography>
        </Stack>
      </Container>
    );
  else if (brain.isEmpty)
    body = (
      <Container data-testid={BrainScreenTestId.Empty} padding="300">
        <Stack align="center" gap="150">
          <EmptyState
            actionLabel={tm("newNote")}
            description={t("empty.description")}
            glyph="brain"
            onAction={() => setCreating(true)}
            title={t("empty.title")}
          />
          <Stack align="center" direction="row" gap="100">
            <Typography
              as="span"
              onClick={() => setImporting(true)}
              role="button"
              size="sm"
              type="note"
              variant="secondary"
            >
              {t("empty.import")}
            </Typography>
            <Typography
              as="span"
              onClick={() => router.push("/teams" as Route)}
              role="button"
              size="sm"
              type="note"
              variant="secondary"
            >
              {t("empty.connect")}
            </Typography>
          </Stack>
        </Stack>
      </Container>
    );
  else {
    const graph = (
      <BrainGraph
        graph={filtered}
        matchIds={matchIds}
        onSelect={select}
        selectedId={selectedId}
        sourceColor={sourceColor}
        sourceName={sourceName}
      />
    );
    const tree = (
      <BrainTree
        graph={filtered}
        matchIds={matchIds}
        onSelect={select}
        selectedId={selectedId}
        sourceColor={sourceColor}
        sourceName={sourceName}
      />
    );
    const note = (
      <NotePane
        graph={brain.graph}
        onSelect={select}
        openQuestions={brain.openQuestions}
        selectedId={selectedId}
      />
    );
    const filters = (
      <Container padding={["0", "200", "100", "200"]}>
        <BrainFilters
          departments={departments}
          filter={filter}
          onChange={setFilter}
          sourceColor={sourceColor}
          sources={brain.sources}
        />
      </Container>
    );

    body = narrow ? (
      <Tabs onValueChange={(v) => setTab(v as NarrowTab)} value={tab}>
        <TabList>
          <Tab value="brain">{t("tabs.brain")}</Tab>
          <Tab value="notes">{t("tabs.notes")}</Tab>
          <Tab value="note">{t("tabs.note")}</Tab>
        </TabList>
        <TabPanel value="brain">
          {filters}
          <Container height="60dvh" minHeight="320px">
            {graph}
          </Container>
        </TabPanel>
        <TabPanel value="notes">
          <Container padding="100">{tree}</Container>
        </TabPanel>
        <TabPanel value="note">{note}</TabPanel>
      </Tabs>
    ) : (
      <>
        {filters}
        <Stack grow minH0 direction="row">
          <Container
            grow
            minW0
            data-testid={BrainScreenTestId.GraphZone}
            overflow="hidden"
            position="relative"
          >
            {graph}
          </Container>
          <Splitter
            label={t("splitter.tree")}
            max={TREE_W.max}
            min={TREE_W.min}
            onChange={setTreeW}
            pane="end"
            value={treeW}
          />
          <Container
            data-testid={BrainScreenTestId.TreeZone}
            overflowY="auto"
            padding="75"
            shrink={false}
            width={`${treeW}px`}
          >
            {tree}
          </Container>
          <Splitter
            label={t("splitter.note")}
            max={NOTE_W.max}
            min={NOTE_W.min}
            onChange={setNoteW}
            pane="end"
            value={noteW}
          />
          <Container
            data-testid={BrainScreenTestId.NoteZone}
            overflowY="auto"
            shrink={false}
            width={`${noteW}px`}
          >
            {note}
          </Container>
        </Stack>
      </>
    );
  }

  return (
    <Container
      data-testid={BrainScreenTestId.Root}
      height={narrow ? undefined : "calc(100dvh - 8rem)"}
      minHeight="560px"
    >
      <Stack minH0 style={{ height: narrow ? undefined : "100%" }}>
        {header}
        {failedSources.length > 0 && (
          <Container
            data-testid={BrainScreenTestId.FailedBanner}
            padding={["0", "200", "100", "200"]}
          >
            <Panel padding="100" tone="warn">
              <Typography size="sm" type="note">
                {t("failedBanner", { names: failedSources.map((s) => s.name).join(", ") })}
              </Typography>
            </Panel>
          </Container>
        )}
        {quickCapturing && (
          <Container padding={["0", "200", "100", "200"]}>
            <Panel header={tm("quickCapture.title")} padding="200">
              <QuickCapture
                onCaptured={(id) => select(brainId(VAULT_SOURCE_ID, id))}
                onClose={() => setQuickCapturing(false)}
              />
            </Panel>
          </Container>
        )}
        {body}
      </Stack>
      {overlays}
    </Container>
  );
}
