"use client";

import { Fragment, type ReactNode, useMemo, useRef, useState } from "react";
import {
  Decoration,
  Diff,
  type FileData,
  Hunk,
  type RenderToken,
  findChangeByNewLineNumber,
  getChangeKey,
  parseDiff,
  tokenize,
} from "react-diff-view";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Panel } from "../Panel/Panel";
import { SearchInput } from "../SearchInput/SearchInput";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";
import { Stack } from "../Stack/Stack";
import { Typography } from "../Typography/Typography";

export enum FileDiffViewTestId {
  Root = "file-diff-view",
  File = "file-diff-view-file",
  FileName = "file-diff-view-file-name",
  /** Per-file collapse toggle in the sticky file header. */
  FileToggle = "file-diff-view-file-toggle",
  /** A/M/D/R status letter (header and rail). */
  Status = "file-diff-view-status",
  /** 5-square +/− bar (header and rail). */
  Bar = "file-diff-view-bar",
  /** "Viewed" checkbox in the file header. */
  Viewed = "file-diff-view-viewed",
  /** "n / m viewed" count above the files. */
  ViewedCount = "file-diff-view-viewed-count",
  /** Unresolved-thread count of a file (header and rail). */
  Threads = "file-diff-view-threads",
  NoHunks = "file-diff-view-no-hunks",
  Empty = "file-diff-view-empty",
  /** "Generated file · hidden" row with its show button. */
  Generated = "file-diff-view-generated",
  GeneratedShow = "file-diff-view-generated-show",
  /** Neutral notice above the files (e.g. the diff was truncated). */
  Notice = "file-diff-view-notice",
  ViewToggle = "file-diff-view-view-toggle",
  FileList = "file-diff-view-file-list",
  FileListFilter = "file-diff-view-file-list-filter",
  FileListDir = "file-diff-view-file-list-dir",
  /** Suffixed `-${index}` (index into the diff's file order). */
  FileListItem = "file-diff-view-file-list-item",
  FileBack = "file-diff-view-file-back",
  FileListToggle = "file-diff-view-file-list-toggle",
  FileListStrip = "file-diff-view-file-list-strip",
  FileListResizer = "file-diff-view-file-list-resizer",
}

export type FileDiffViewType = "unified" | "split";

export interface FileDiffViewProps {
  /** Unified diff text (`git diff` output). */
  diff: string;
  /** Shown when the diff has no files. */
  emptyLabel?: string;
  /** Shown for a file without hunks (binary file or pure rename). */
  noHunksLabel?: string;
  /** Show a collapsible changed-files rail left of the diff; click scrolls to the file. */
  fileList?: boolean;
  /**
   * Phone layout: a full-width list of the changed files; picking one shows only that file (unified)
   * under a back button. Replaces the side rail. One file → straight to it.
   */
  oneAtATime?: boolean;
  /** Back button text in `oneAtATime` mode. */
  backLabel?: string;
  filesLabel?: string;
  collapseLabel?: string;
  expandLabel?: string;
  /** Accessible name of the drag handle between the rail and the diff. */
  resizeLabel?: string;
  /** Placeholder / accessible name of the rail's file filter. */
  filterLabel?: string;
  /** Show each file's name above its hunks (default). Off when the caller already names the file. */
  showFileName?: boolean;
  /** Accessible names of the per-file collapse toggle. */
  collapseFileLabel?: string;
  expandFileLabel?: string;
  /** Offer the unified ↔ split toggle (callers hide it on phones). */
  splitToggle?: boolean;
  viewLabel?: string;
  unifiedLabel?: string;
  splitLabel?: string;
  /** Row text of a generated file (lock file, `*.min.*`, `dist/`, `*.snap`), hidden until shown. */
  generatedLabel?: string;
  showGeneratedLabel?: string;
  /** Neutral notice above the files (e.g. truncation). */
  notice?: string;
  /** Unresolved review-thread count per new path. */
  threadCounts?: Record<string, number>;
  /** Accessible text of a thread count. */
  threadsLabel?: (count: number) => string;
  /** Nodes rendered under a line, keyed by new path, then new-side line number. */
  lineWidgets?: Record<string, Record<number, ReactNode>>;
  /** Viewed paths; with `onViewedChange` each header gets a "Viewed" checkbox and viewed files collapse. */
  viewed?: Record<string, boolean>;
  onViewedChange?: (path: string, viewed: boolean) => void;
  viewedLabel?: string;
  viewedCountLabel?: (viewed: number, total: number) => string;
}

const MIN_WIDTH = 15;
const MAX_WIDTH = 60;
const clampWidth = (n: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(n)));

const DEV_NULL = "/dev/null";

function fileLabel(oldPath: string, newPath: string) {
  if (newPath === DEV_NULL) return oldPath;
  if (oldPath === DEV_NULL || oldPath === newPath) return newPath;
  return `${oldPath} → ${newPath}`;
}

const filePath = (f: FileData) => (f.newPath === DEV_NULL ? f.oldPath : f.newPath);

const STATUS = { add: "A", delete: "D", modify: "M", rename: "R", copy: "R" } as const;

// ponytail: path heuristic only — the unified diff carries no linguist-generated flag.
const GENERATED =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|composer\.lock|Cargo\.lock|Gemfile\.lock|poetry\.lock|go\.sum)$|\.min\.[a-z]+$|(^|\/)dist\/|\.snap$/;
export const isGeneratedPath = (path: string) => GENERATED.test(path);

// ponytail: regex tokenizer (comments, strings, keywords, JSX/type names) — no grammar per
// language; swap for refractor via react-diff-view `tokenize({refractor})` if it ever matters.
const SYNTAX =
  /(\/\/.*$|#.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`[^`]*`)|\b(const|let|var|return|await|async|export|default|function|import|from|if|else|for|while|new|type|interface|class|extends|public|private|static|def|use|namespace)\b|(<\/?[A-Z]\w*|\b[A-Z]\w*\b)/g;
const SYNTAX_CLASS = [
  "text-[var(--color-syn-comment)]",
  "text-[var(--color-syn-string)]",
  "text-[var(--color-syn-keyword)]",
  "text-[var(--color-syn-type)]",
];

export function highlightCode(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of code.matchAll(SYNTAX)) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const group = m.slice(1).findIndex(Boolean);
    out.push(
      <span className={SYNTAX_CLASS[group]} key={m.index}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

const renderToken: RenderToken = (token, renderDefault, i) =>
  token.type === "text" && typeof token["value"] === "string" ? (
    <Fragment key={i}>{highlightCode(token["value"])}</Fragment>
  ) : (
    renderDefault(token, i)
  );

function counts(f: FileData) {
  const changes = f.hunks.flatMap((h) => h.changes);
  return {
    added: changes.filter((c) => c.type === "insert").length,
    removed: changes.filter((c) => c.type === "delete").length,
  };
}

/** Five squares split by the file's own +/− ratio (GitHub-style). */
function DiffBar({ added, removed }: { added: number; removed: number }) {
  const total = added + removed || 1;
  const na = Math.round((added / total) * 5);
  const nd = Math.min(5 - na, Math.round((removed / total) * 5));
  return (
    <span
      aria-label={`+${added} −${removed}`}
      className="inline-flex flex-none gap-[1.5px]"
      data-testid={FileDiffViewTestId.Bar}
      role="img"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <i
          className={cn(
            "size-[6px] rounded-[1.5px]",
            i < na ? "bg-state-done" : i < na + nd ? "bg-state-err" : "bg-line-2",
          )}
          key={i}
        />
      ))}
    </span>
  );
}

function StatusLetter({ file }: { file: FileData }) {
  const s = STATUS[file.type];
  return (
    <span
      className={cn(
        "grid size-[14px] flex-none place-items-center rounded-[4px] font-mono text-[10px] font-semibold",
        s === "A" &&
          "bg-[color-mix(in_srgb,var(--color-state-done)_12%,transparent)] text-state-done",
        s === "D" &&
          "bg-[color-mix(in_srgb,var(--color-state-err)_12%,transparent)] text-state-err",
        (s === "M" || s === "R") && "bg-line text-ink-2",
      )}
      data-testid={FileDiffViewTestId.Status}
    >
      {s}
    </span>
  );
}

function ThreadCount({ count, label }: { count: number; label: string }) {
  return (
    <span
      aria-label={label}
      className="inline-flex flex-none items-center gap-[4px] font-mono text-[10px] text-accent-fg"
      data-testid={FileDiffViewTestId.Threads}
    >
      <i className="size-[7px] rounded-full bg-state-block" />
      {count}
    </span>
  );
}

const headerButton = cn(
  "grid size-[22px] flex-none cursor-pointer place-items-center rounded bg-transparent text-ink-3 hover:text-ink",
  focusRingInset,
);

/** Renders a unified diff, one section per changed file. Styles live in theme/globals.css. */
export function FileDiffView({
  diff,
  emptyLabel = "No changes.",
  noHunksLabel = "No textual changes (binary file or rename).",
  fileList = false,
  oneAtATime = false,
  backLabel = "Files",
  filesLabel = "Files changed",
  collapseLabel = "Collapse file list",
  expandLabel = "Expand file list",
  resizeLabel = "Resize file list",
  filterLabel = "Filter files",
  showFileName = true,
  collapseFileLabel = "Collapse file",
  expandFileLabel = "Expand file",
  splitToggle = false,
  viewLabel = "Diff view",
  unifiedLabel = "Unified",
  splitLabel = "Split",
  generatedLabel = "Generated file · diff hidden.",
  showGeneratedLabel = "Show",
  notice,
  threadCounts,
  threadsLabel = (n) => `${n} unresolved threads`,
  lineWidgets,
  viewed,
  onViewedChange,
  viewedLabel = "Viewed",
  viewedCountLabel = (n, m) => `${n} / ${m} viewed`,
}: FileDiffViewProps) {
  // parseDiff("") yields one phantom empty file, so blank input is short-circuited.
  const files = useMemo(() => (diff.trim() ? parseDiff(diff) : []), [diff]);
  const tokens = useMemo(() => files.map((f) => tokenize(f.hunks)), [files]);

  const sections = useRef<(HTMLElement | null)[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(25);
  const [filter, setFilter] = useState("");
  const [viewType, setViewType] = useState<FileDiffViewType>("unified");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [shownGenerated, setShownGenerated] = useState<Record<string, boolean>>({});
  const grid = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  if (files.length === 0) {
    return (
      <Panel padding="300">
        <Typography data-testid={FileDiffViewTestId.Empty} type="text" variant="secondary">
          {emptyLabel}
        </Typography>
      </Panel>
    );
  }

  const view = splitToggle ? viewType : "unified";

  const body = (file: FileData, i: number) => {
    const path = filePath(file);
    if (isGeneratedPath(path) && !shownGenerated[path])
      return (
        <div
          className="flex items-center gap-[10px] px-[10px] py-[8px] font-sans text-[12px] text-ink-3"
          data-testid={FileDiffViewTestId.Generated}
        >
          <span className="min-w-0 flex-1">{generatedLabel}</span>
          <button
            className={cn(
              "cursor-pointer bg-transparent text-ink-2 hover:text-ink",
              focusRingInset,
            )}
            data-testid={FileDiffViewTestId.GeneratedShow}
            onClick={() => setShownGenerated((s) => ({ ...s, [path]: true }))}
            type="button"
          >
            {showGeneratedLabel}
          </button>
        </div>
      );
    if (file.hunks.length === 0)
      return (
        <Typography data-testid={FileDiffViewTestId.NoHunks} type="note" variant="secondary">
          {noHunksLabel}
        </Typography>
      );
    const widgets: Record<string, ReactNode> = {};
    for (const [line, node] of Object.entries(lineWidgets?.[path] ?? {})) {
      const change = findChangeByNewLineNumber(file.hunks, Number(line));
      if (change) widgets[getChangeKey(change)] = node;
    }
    return (
      <Diff
        diffType={file.type}
        hunks={file.hunks}
        renderToken={renderToken}
        tokens={tokens[i]}
        viewType={view}
        widgets={widgets}
      >
        {(hunks) =>
          hunks.flatMap((h) => [
            // Snippets (no file name) stay bare: no `@@` hunk header.
            ...(showFileName ? [<Decoration key={`d${h.content}`}>{h.content}</Decoration>] : []),
            <Hunk hunk={h} key={`${h.oldStart}-${h.newStart}`} />,
          ])
        }
      </Diff>
    );
  };

  const sectionsView = (
    <Stack data-testid={FileDiffViewTestId.Root} gap="200">
      {notice && (
        <div
          className="rounded border border-dashed border-line-2 px-[12px] py-[9px] font-sans text-[12.5px] text-ink-2"
          data-testid={FileDiffViewTestId.Notice}
        >
          {notice}
        </div>
      )}
      {(splitToggle || onViewedChange) && (
        <div className="flex items-center justify-end gap-[10px] font-sans text-[12px] text-ink-3">
          {onViewedChange && (
            <span data-testid={FileDiffViewTestId.ViewedCount}>
              {viewedCountLabel(files.filter((f) => viewed?.[filePath(f)]).length, files.length)}
            </span>
          )}
          {splitToggle && (
            <span data-testid={FileDiffViewTestId.ViewToggle}>
              <SegmentedControl
                ariaLabel={viewLabel}
                items={[
                  { value: "unified", label: unifiedLabel },
                  { value: "split", label: splitLabel },
                ]}
                onChange={(v) => setViewType(v as FileDiffViewType)}
                size="sm"
                value={viewType}
              />
            </span>
          )}
        </div>
      )}
      {files.map((file, i) => {
        if (oneAtATime && (files.length > 1 ? openIdx : 0) !== i) return null;
        const path = filePath(file);
        const isViewed = Boolean(viewed?.[path]);
        const isClosed = closed[path] ?? isViewed;
        const threads = threadCounts?.[path] ?? 0;
        return (
          <section
            className={cn(showFileName && "rounded border border-line")}
            data-testid={FileDiffViewTestId.File}
            key={`${file.oldPath}->${file.newPath}`}
            ref={(el: HTMLElement | null) => {
              sections.current[i] = el;
            }}
          >
            {showFileName && (
              <div
                className={cn(
                  "sticky top-0 z-[2] flex items-center gap-[8px] bg-panel-2 px-[10px] py-[6px] font-sans text-[12px]",
                  !isClosed && "border-b border-line",
                )}
              >
                <button
                  aria-expanded={!isClosed}
                  aria-label={isClosed ? expandFileLabel : collapseFileLabel}
                  className={headerButton}
                  data-testid={FileDiffViewTestId.FileToggle}
                  onClick={() => setClosed((c) => ({ ...c, [path]: !isClosed }))}
                  type="button"
                >
                  {isClosed ? "›" : "⌄"}
                </button>
                <StatusLetter file={file} />
                <span className="min-w-0 truncate">
                  <Typography mono data-testid={FileDiffViewTestId.FileName} type="data">
                    {fileLabel(file.oldPath, file.newPath)}
                  </Typography>
                </span>
                <DiffBar {...counts(file)} />
                <span className="flex-1" />
                {threads > 0 && <ThreadCount count={threads} label={threadsLabel(threads)} />}
                {onViewedChange && (
                  <label className="inline-flex cursor-pointer items-center gap-[6px] rounded border border-line px-[6px] py-[2px] text-ink-3">
                    <input
                      checked={isViewed}
                      className="m-0 accent-[var(--color-state-done)]"
                      data-testid={FileDiffViewTestId.Viewed}
                      onChange={(e) => {
                        onViewedChange(path, e.target.checked);
                        setClosed((c) => {
                          const next = { ...c };
                          delete next[path];
                          return next;
                        });
                      }}
                      type="checkbox"
                    />
                    {viewedLabel}
                  </label>
                )}
              </div>
            )}
            {!isClosed && (
              // Lazy per-file render: the browser skips layout/paint of off-screen files.
              <div className="[contain-intrinsic-size:auto_320px] [content-visibility:auto]">
                {body(file, i)}
              </div>
            )}
          </section>
        );
      })}
    </Stack>
  );
  if (!fileList && !oneAtATime) return sectionsView;
  if (oneAtATime && files.length === 1) return sectionsView;

  const toggle = (
    <button
      aria-expanded={!collapsed}
      aria-label={collapsed ? expandLabel : collapseLabel}
      className="cursor-pointer bg-transparent px-[6px] py-[2px] text-[14px] text-ink-2 hover:text-ink"
      data-testid={FileDiffViewTestId.FileListToggle}
      onClick={() => setCollapsed((c) => !c)}
      type="button"
    >
      {collapsed ? "›" : "‹"}
    </button>
  );

  const q = filter.trim().toLowerCase();
  const dirOf = (path: string) => path.slice(0, path.lastIndexOf("/") + 1);
  const visible = files
    .map((file, i) => ({ file, i, path: filePath(file) }))
    .filter(({ path }) => !q || path.toLowerCase().includes(q));
  const railItems = visible.map(({ file, i, path }, v) => {
    const dir = dirOf(path);
    const cut = dir.length;
    const prev = visible[v - 1];
    const showDir = dir !== "" && (!prev || dirOf(prev.path) !== dir);
    const threads = threadCounts?.[path] ?? 0;
    return (
      <Fragment key={`${file.oldPath}->${file.newPath}`}>
        {showDir && (
          <div
            className="truncate px-[6px] pt-[8px] pb-[3px] font-mono text-[11px] text-ink-3"
            data-testid={FileDiffViewTestId.FileListDir}
          >
            {dir}
          </div>
        )}
        <button
          className={cn(
            "flex cursor-pointer items-center gap-[7px] rounded bg-transparent py-[4px] pr-[6px] text-left text-ink-2 hover:bg-line hover:text-ink",
            dir ? "pl-[14px]" : "pl-[6px]",
          )}
          data-testid={`${FileDiffViewTestId.FileListItem}-${i}`}
          onClick={() =>
            oneAtATime
              ? setOpenIdx(i)
              : sections.current[i]?.scrollIntoView({ block: "start", behavior: "smooth" })
          }
          title={fileLabel(file.oldPath, file.newPath)}
          type="button"
        >
          <StatusLetter file={file} />
          <span className={cn("min-w-0 flex-1 truncate", viewed?.[path] && "text-ink-3")}>
            {path.slice(cut)}
          </span>
          {threads > 0 && <ThreadCount count={threads} label={threadsLabel(threads)} />}
          {viewed?.[path] ? (
            <span aria-label={viewedLabel} className="text-state-done" role="img">
              ✓
            </span>
          ) : (
            <DiffBar {...counts(file)} />
          )}
        </button>
      </Fragment>
    );
  });

  if (oneAtATime)
    return openIdx === null ? (
      <nav
        aria-label={filesLabel}
        className="flex flex-col gap-[2px] font-sans text-[13px]"
        data-testid={FileDiffViewTestId.FileList}
      >
        {notice && (
          <div
            className="mb-[6px] rounded border border-dashed border-line-2 px-[12px] py-[9px] text-[12.5px] text-ink-2"
            data-testid={FileDiffViewTestId.Notice}
          >
            {notice}
          </div>
        )}
        {railItems}
      </nav>
    ) : (
      <Stack gap="150">
        <button
          className={cn(
            "inline-flex w-fit cursor-pointer items-center gap-[6px] bg-transparent py-[4px] font-sans text-[13px] text-ink-2 hover:text-ink",
            focusRingInset,
          )}
          data-testid={FileDiffViewTestId.FileBack}
          onClick={() => setOpenIdx(null)}
          type="button"
        >
          ‹ {backLabel}
        </button>
        {sectionsView}
      </Stack>
    );

  return (
    <div
      className={cn(
        "grid items-start",
        collapsed ? "grid-cols-[28px_minmax(0,1fr)] gap-[12px]" : "gap-x-[3px]",
      )}
      ref={grid}
      style={collapsed ? undefined : { gridTemplateColumns: `${width}% 6px minmax(0,1fr)` }}
    >
      {collapsed ? (
        <div
          className="sticky top-0 flex justify-center border-r border-line"
          data-testid={FileDiffViewTestId.FileListStrip}
        >
          {toggle}
        </div>
      ) : (
        <nav
          aria-label={filesLabel}
          className="sticky top-0 flex max-h-[70vh] flex-col gap-[2px] overflow-y-auto border-r border-line pr-[8px] font-sans text-[12.5px]"
          data-testid={FileDiffViewTestId.FileList}
        >
          <div className="flex items-center justify-between uppercase tracking-wider text-[10px] text-ink-3">
            <span>{filesLabel}</span>
            {toggle}
          </div>
          <SearchInput
            ariaLabel={filterLabel}
            data-testid={FileDiffViewTestId.FileListFilter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={filterLabel}
            value={filter}
          />
          {railItems}
        </nav>
      )}
      {!collapsed && (
        <div
          aria-label={resizeLabel}
          aria-orientation="vertical"
          aria-valuemax={MAX_WIDTH}
          aria-valuemin={MIN_WIDTH}
          aria-valuenow={width}
          className={cn(
            "sticky top-0 h-[70vh] cursor-col-resize touch-none hover:bg-line",
            focusRingInset,
          )}
          data-testid={FileDiffViewTestId.FileListResizer}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            setWidth((w) => clampWidth(w + (e.key === "ArrowLeft" ? -2 : 2)));
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            dragging.current = true;
          }}
          onPointerMove={(e) => {
            const rect = grid.current?.getBoundingClientRect();
            if (!dragging.current || !rect || rect.width === 0) return;
            setWidth(clampWidth(((e.clientX - rect.left) / rect.width) * 100));
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          role="separator"
          tabIndex={0}
        />
      )}
      {sectionsView}
    </div>
  );
}
