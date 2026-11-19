"use client";
import { Button, Container, Dialog, Stack, Typography } from "@zibby/design-system";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Workflow } from "../../../../domain";
import { isOperatorTokenError } from "../../../../state/operatorToken";
import { useAgentsQuery } from "../../../agents";
import { OperatorTokenNotice } from "../../../ai-providers";
import { useDepartmentLookup } from "../../../departments/useDepartmentLookup";
import {
  duplicateWorkflowBody,
  useDeleteWorkflowMutation,
  useDuplicateWorkflowMutation,
  useUpdateWorkflowMutation,
} from "../../mutations";
import { useWorkflowRunsQuery, useWorkflowsQuery } from "../../queries";
import { outputsValid } from "../OutputsEditor/OutputsEditor";
import {
  INITIAL_ASSIGNMENT,
  attemptsFromStageRuns,
  collectProblems,
  graphToPhases,
  insertNodeAt,
  makeNode,
  makeStepNode,
  orderNodes,
  phasesToGraph,
  removeNode,
} from "../WorkflowDialog/workflow-graph";
import type { GraphProblem } from "../WorkflowDialog/workflow-graph";
import { FlowCanvas } from "./FlowCanvas";
import { INSPECTOR_DEFAULT, Inspector } from "./Inspector";
import { Palette } from "./Palette";
import { RunWorkflowSheet } from "./RunWorkflowSheet";
import type { PhaseDrop } from "./dnd";
import { useGraphHistory } from "./useGraphHistory";
import { usePhaseLabel } from "./usePhaseLabel";
import { useWdT } from "./useWdT";
import { WorkflowBar } from "./WorkflowBar";
import { type WorkflowDraft, draftDirty, draftFromWorkflow, draftPatch } from "./workflowDraft";

export interface WorkflowDetailScreenProps {
  workflow: Workflow;
  /** The list route this page returns to (`/work/workflows` or a department's tab). */
  basePath: string;
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** `/work/workflows/[id]` — the full-page workflow editor: bar, canvas, palette and inspector. */
export function WorkflowDetailScreen({ workflow, basePath }: WorkflowDetailScreenProps) {
  const t = useWdT("workflowDetail");
  const router = useRouter();
  const { data: agents = [] } = useAgentsQuery();
  const { data: workflows = [] } = useWorkflowsQuery();
  const departments = useDepartmentLookup();
  const [runOpen, setRunOpen] = useState(false);
  const update = useUpdateWorkflowMutation();
  const duplicate = useDuplicateWorkflowMutation();
  const remove = useDeleteWorkflowMutation();
  const tp = useWdT("workflowDetail.parity");
  const label = usePhaseLabel(agents);

  const viewGraph = useMemo(() => phasesToGraph(workflow, agents), [workflow, agents]);
  const history = useGraphHistory(viewGraph);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkflowDraft>(() => draftFromWorkflow(workflow));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loopOpenId, setLoopOpenId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [insertAfter, setInsertAfter] = useState<string | null>(null);
  const [inspectorW, setInspectorW] = useState(INSPECTOR_DEFAULT);

  // Another workflow (route change) starts fresh in read mode.
  const lastId = useRef(workflow.id);
  useEffect(() => {
    if (lastId.current === workflow.id) return;
    lastId.current = workflow.id;
    setEditing(false);
    setSelectedId(null);
    setSettingsOpen(false);
    setLoopOpenId(null);
    setDraft(draftFromWorkflow(workflow));
  }, [workflow]);

  const graph = editing ? history.graph : viewGraph;
  const assignment = workflow.phases[0]?.consumes ?? INITIAL_ASSIGNMENT;
  const phases = useMemo(() => graphToPhases(graph, assignment), [graph, assignment]);
  const initialPhases = useMemo(
    () => graphToPhases(viewGraph, assignment),
    [viewGraph, assignment],
  );
  const phasesChanged = JSON.stringify(phases) !== JSON.stringify(initialPhases);
  const dirty = editing && (phasesChanged || draftDirty(workflow, draft));
  const problems = useMemo(() => collectProblems(graph, draft.name), [graph, draft.name]);
  const allProblems: GraphProblem[] = outputsValid(draft.outputs)
    ? problems
    : [...problems, { kind: "outputs" }];

  const { data: runs = [] } = useWorkflowRunsQuery();
  const run = runs.find((r) => r.workflowId === workflow.id);
  const attempts = run ? attemptsFromStageRuns(run.stageRuns) : undefined;
  const workflowNames = useMemo(() => new Map(workflows.map((w) => [w.id, w.name])), [workflows]);
  const workflowSizes = useMemo(
    () => new Map(workflows.map((w) => [w.id, w.phases.length])),
    [workflows],
  );

  const startEdit = () => {
    history.reset(viewGraph);
    setDraft(draftFromWorkflow(workflow));
    setEditing(true);
    setSettingsOpen(true);
  };
  const stopEdit = () => {
    setEditing(false);
    setInsertAfter(null);
    setLoopOpenId(null);
    setSettingsOpen(false);
  };
  const exportJson = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(workflow, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const closeInspector = () => {
    if (selectedId) setSelectedId(null);
    else setSettingsOpen(false);
  };
  const inspectorOpen = selectedId !== null || settingsOpen;
  const save = () => {
    if (!dirty || allProblems.length > 0 || update.isPending) return;
    const patch = draftPatch(workflow, draft);
    if (phasesChanged) patch.phases = phases;
    update.mutate({ params: { id: workflow.id }, body: patch }, { onSuccess: stopEdit });
  };

  const addAt = (drop: PhaseDrop, index: number) => {
    const n = history.graph.nodes.length + 1;
    const node =
      drop.kind === "agent"
        ? (() => {
            const a = agents.find((x) => x.id === drop.id);
            return a ? makeNode(a, n, 0, 0) : null;
          })()
        : makeStepNode(drop.type, n, 0, 0);
    if (!node) return;
    history.set((g) => insertNodeAt(g, node, index));
    setSelectedId(node.id);
    setInsertAfter(null);
  };
  const addFromPalette = (drop: PhaseDrop) => {
    const order = orderNodes(history.graph);
    const at = insertAfter ? order.findIndex((x) => x.id === insertAfter) + 1 : order.length;
    addAt(drop, at);
  };
  const toggleCheckpoint = (id: string) =>
    history.set((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === id ? { ...n, approval: n.approval === "ask" ? undefined : "ask" } : n,
      ),
    }));

  // Keyboard: Esc closes the inspector/popover, A toggles the palette, ⌘Z / ⇧⌘Z, ⌘S, Delete.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (runOpen) setRunOpen(false);
      else if (loopOpenId) setLoopOpenId(null);
      else if (insertAfter) setInsertAfter(null);
      else closeInspector();
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === ",") {
      e.preventDefault();
      setSelectedId(null);
      setSettingsOpen(true);
      return;
    }
    if (isTyping(e.target) || !editing) return;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) history.redo();
      else history.undo();
    } else if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
    } else if (!mod && e.key.toLowerCase() === "a") setPaletteOpen((v) => !v);
    else if (!mod && (e.key === "Delete" || e.key === "Backspace") && selectedId) {
      history.set((g) => removeNode(g, selectedId));
      setSelectedId(null);
    }
  };
  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const insertAfterNode = insertAfter ? graph.nodes.find((n) => n.id === insertAfter) : undefined;
  const problemLabel = (p: GraphProblem) => {
    const node = p.nodeId ? graph.nodes.find((n) => n.id === p.nodeId) : undefined;
    const what = t(`problems.${p.kind}`);
    return node ? `${label(node)} · ${what}` : what;
  };
  const hasPr = (editing ? draft.outputs : workflow.outputs).some((o) => o.type === "pr");
  const err = update.error ?? duplicate.error;

  return (
    // The shell's chrome (94px) and bottom padding (72px) sit around this page: fill what is left.
    <Stack
      data-testid="wd-screen"
      gap="0"
      style={{
        height: "calc(100dvh - 94px)",
        minHeight: 560,
        // cancels the shell's 72px bottom padding so the canvas reaches the viewport edge
        marginBottom: -72,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <WorkflowBar
        department={workflow.department ? departments.get(workflow.department)?.name : undefined}
        dirty={dirty}
        duplicating={duplicate.isPending}
        editing={editing}
        file={workflow.file}
        name={draft.name || workflow.name}
        onBack={() => router.push(basePath as Route)}
        onCancel={stopEdit}
        onCopyFile={() => void navigator.clipboard?.writeText(workflow.file)}
        onDelete={() => setConfirmDelete(true)}
        onDuplicate={() => {
          const body = duplicateWorkflowBody(
            workflow,
            workflows.map((w) => w.id),
          );
          duplicate.mutate(
            { body },
            { onSuccess: () => router.push(`${basePath}/${body.id}` as Route) },
          );
        }}
        onEdit={startEdit}
        onExport={exportJson}
        onNameChange={(name) => setDraft((d) => ({ ...d, name }))}
        onOpenSettings={() => {
          setSelectedId(null);
          setSettingsOpen(true);
        }}
        onRun={() => setRunOpen((v) => !v)}
        onRunHistory={() => router.push("/activity/runs" as Route)}
        onSave={save}
        onSelectProblem={(id) => setSelectedId(id ?? null)}
        problemLabel={problemLabel}
        problems={allProblems}
        saving={update.isPending}
        workflowId={workflow.id}
      />
      {runOpen && (
        <RunWorkflowSheet
          onClose={() => setRunOpen(false)}
          workflowId={workflow.id}
          workflowName={workflow.name}
        />
      )}
      {isOperatorTokenError(err) && (
        <Container padding={["100", "200"]}>
          <OperatorTokenNotice />
        </Container>
      )}
      <Stack direction="row" gap="0" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {editing && (
          <Palette
            agents={agents}
            departments={departments.list}
            insertAfterLabel={insertAfterNode ? label(insertAfterNode) : undefined}
            onAdd={addFromPalette}
            onCancelInsert={() => setInsertAfter(null)}
            onOpenChange={setPaletteOpen}
            open={paletteOpen}
          />
        )}
        <Container grow minW0 position="relative">
          <FlowCanvas
            agents={agents}
            attempts={attempts}
            canRedo={history.canRedo}
            canUndo={history.canUndo}
            departments={departments.list}
            editing={editing}
            graph={graph}
            hasPrOutput={hasPr}
            loopOpenId={loopOpenId}
            onDrop={addAt}
            onInsertAfter={(id) => {
              setInsertAfter(id);
              setPaletteOpen(true);
            }}
            onLoopOpen={setLoopOpenId}
            onSelect={setSelectedId}
            onToggleCheckpoint={toggleCheckpoint}
            problems={editing ? allProblems : []}
            redo={history.redo}
            selectedId={selectedId}
            setGraph={history.set}
            undo={history.undo}
            workflowNames={workflowNames}
            workflowSizes={workflowSizes}
          />
        </Container>
        {inspectorOpen && (
          <Inspector
            agents={agents}
            departments={departments.list}
            draft={draft}
            editing={editing}
            graph={graph}
            onClose={closeInspector}
            onDraftChange={setDraft}
            onWidthChange={setInspectorW}
            problems={editing ? allProblems : []}
            selectedId={selectedId}
            setGraph={history.set}
            width={inspectorW}
            workflow={workflow}
            workflows={workflows}
          />
        )}
      </Stack>
      <Dialog
        actions={
          <>
            <Button intent="ghost" onClick={() => setConfirmDelete(false)} size="sm">
              {tp("cancel")}
            </Button>
            <Button
              intent="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { params: { id: workflow.id } },
                  { onSuccess: () => router.push(basePath as Route) },
                )
              }
              size="sm"
            >
              {tp("deleteConfirm")}
            </Button>
          </>
        }
        onClose={() => setConfirmDelete(false)}
        open={confirmDelete}
        title={tp("deleteTitle", { name: workflow.name })}
      >
        <Typography size="sm" type="note" variant="secondary">
          {tp("deleteBody")}
        </Typography>
      </Dialog>
    </Stack>
  );
}
