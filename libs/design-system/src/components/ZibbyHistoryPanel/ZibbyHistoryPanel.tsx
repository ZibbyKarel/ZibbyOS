"use client";
import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import { ZibbyIconButton } from "../ZibbyIconButton/ZibbyIconButton";

export enum ZibbyHistoryPanelTestId {
  Root = "zibby-history-panel-root",
  Header = "zibby-history-panel-header",
  Title = "zibby-history-panel-title",
  Count = "zibby-history-panel-count",
  CloseButton = "zibby-history-panel-close-button",
  NewButton = "zibby-history-panel-new-button",
  Search = "zibby-history-panel-search",
  SearchInput = "zibby-history-panel-search-input",
  SearchClear = "zibby-history-panel-search-clear",
  List = "zibby-history-panel-list",
  /** Suffixed with the group index. */
  Group = "zibby-history-panel-group",
  /** Suffixed with the conversation id — the row wrapper. */
  Row = "zibby-history-panel-row",
  /** Suffixed with the conversation id — the open button. */
  RowButton = "zibby-history-panel-row-button",
  RowTitle = "zibby-history-panel-row-title",
  RowTime = "zibby-history-panel-row-time",
  RowSnippet = "zibby-history-panel-row-snippet",
  RenameButton = "zibby-history-panel-rename-button",
  DeleteButton = "zibby-history-panel-delete-button",
  RenameInput = "zibby-history-panel-rename-input",
  Mark = "zibby-history-panel-mark",
  Empty = "zibby-history-panel-empty",
  Footer = "zibby-history-panel-footer",
}

export interface ZibbyHistoryItemData {
  id: string;
  title: string;
  /** Pre-formatted time label ("14:32", "yesterday", "now"). */
  time: string;
  /** Last / matching message excerpt, one ellipsised line. */
  snippet?: string;
  /** The conversation currently open (`aria-current`). */
  active?: boolean;
}

export interface ZibbyHistoryGroup {
  label: string;
  items: ZibbyHistoryItemData[];
}

export interface ZibbyHistoryPanelProps {
  title?: string;
  /** Conversation count next to the title (mono). */
  count?: number | string;
  closeLabel?: string;
  onClose?: () => void;
  newLabel?: string;
  onNew?: () => void;
  searchLabel?: string;
  searchPlaceholder?: string;
  clearSearchLabel?: string;
  query: string;
  onQueryChange: (query: string) => void;
  groups: ZibbyHistoryGroup[];
  /** Shown when there are no items at all (e.g. "Nothing found for “x”"). */
  emptyLabel?: string;
  onOpen: (id: string) => void;
  onRename?: (id: string, next: string) => void;
  onDelete?: (id: string) => void;
  /** Id of the row in rename mode. Controlled with `onRenamingIdChange`; omit for internal state. */
  renamingId?: string | null;
  onRenamingIdChange?: (id: string | null) => void;
  renameLabel?: (title: string) => string;
  deleteLabel?: (title: string) => string;
  renameInputLabel?: string;
  /** Footer slot (hints). */
  footer?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

const markClass = "rounded-[3px] bg-accent/[0.18] px-px text-accent-fg dark:bg-accent/[0.12]";

function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          // Odd split segments are the captured matches.
          <mark className={markClass} data-testid={ZibbyHistoryPanelTestId.Mark} key={i}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

interface RenameRowProps {
  item: ZibbyHistoryItemData;
  label: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}

function RenameRow({ item, label, onCommit, onCancel }: RenameRowProps) {
  const [draft, setDraft] = useState(item.title);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const next = draft.trim();
    if (commit && next !== "" && next !== item.title) onCommit(next);
    else onCancel();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  };
  return (
    <div
      className="mb-px rounded-[9px] bg-panel-2 shadow-[inset_0_0_0_1px_var(--color-line-2)]"
      data-testid={`${ZibbyHistoryPanelTestId.Row}-${item.id}`}
    >
      <input
        aria-label={label}
        className={cn(
          "h-[38px] w-full rounded-[9px] border border-ink-3 bg-bg px-[10px] font-sans text-[13.5px] text-ink",
          "outline-none focus-visible:ring-2 focus-visible:ring-accent",
        )}
        data-testid={`${ZibbyHistoryPanelTestId.RenameInput}-${item.id}`}
        onBlur={() => finish(true)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        ref={ref}
        value={draft}
      />
    </div>
  );
}

/**
 * The inside of the overlay's history panel (`.zh`): header with count, "new" button, search,
 * grouped conversation list with highlight, rename and delete, and a footer slot. A vertical flex
 * column that fills its parent; the shell (width, surface, slide) belongs to the overlay.
 */
export function ZibbyHistoryPanel({
  title = "Conversations",
  count,
  closeLabel = "Close history",
  onClose,
  newLabel = "New conversation",
  onNew,
  searchLabel = "Search conversations",
  searchPlaceholder = "Search conversations…",
  clearSearchLabel = "Clear search",
  query,
  onQueryChange,
  groups,
  emptyLabel = "Nothing found",
  onOpen,
  onRename,
  onDelete,
  renamingId,
  onRenamingIdChange,
  renameLabel = (t) => `Rename “${t}”`,
  deleteLabel = (t) => `Delete “${t}”`,
  renameInputLabel = "New conversation name",
  footer,
  ref,
}: ZibbyHistoryPanelProps) {
  const [innerRenaming, setInnerRenaming] = useState<string | null>(null);
  const currentRenaming = renamingId === undefined ? innerRenaming : renamingId;
  const setRenaming = (id: string | null) => {
    if (renamingId === undefined) setInnerRenaming(id);
    onRenamingIdChange?.(id);
  };
  const listRef = useRef<HTMLDivElement>(null);
  const idBase = useId();
  const visible = groups.filter((g) => g.items.length > 0);

  const rowButtons = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-zibby-row]") ?? []);

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.hasAttribute("data-zibby-row")) return;
    const rows = rowButtons();
    const i = rows.indexOf(target as HTMLButtonElement);
    const next =
      e.key === "ArrowDown"
        ? rows[Math.min(i + 1, rows.length - 1)]
        : e.key === "ArrowUp"
          ? rows[Math.max(i - 1, 0)]
          : e.key === "Home"
            ? rows[0]
            : rows[rows.length - 1];
    e.preventDefault();
    next?.focus();
  };

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col font-sans text-ink"
      data-testid={ZibbyHistoryPanelTestId.Root}
      ref={ref}
    >
      <div
        className="flex items-center gap-2 pt-4 pr-3 pb-[10px] pl-[18px]"
        data-testid={ZibbyHistoryPanelTestId.Header}
      >
        <h2
          className="m-0 text-[15px] font-semibold tracking-[-0.01em]"
          data-testid={ZibbyHistoryPanelTestId.Title}
        >
          {title}
        </h2>
        {count != null && (
          <span
            className="font-mono text-[12px] text-ink-3"
            data-testid={ZibbyHistoryPanelTestId.Count}
          >
            {count}
          </span>
        )}
        <span className="flex-1" />
        {onClose && (
          <ZibbyIconButton
            mirror
            data-testid={ZibbyHistoryPanelTestId.CloseButton}
            icon="chevron"
            label={closeLabel}
            onClick={onClose}
          />
        )}
      </div>

      {onNew && (
        <div className="px-[14px] pb-[10px]">
          <Button
            block
            data-testid={ZibbyHistoryPanelTestId.NewButton}
            icon="plus"
            intent="secondary"
            onClick={onNew}
            size="md"
          >
            {newLabel}
          </Button>
        </div>
      )}

      <label
        className={cn(
          "mx-[14px] mb-[6px] flex h-[34px] items-center gap-2 rounded-[9px] border border-line-2 bg-bg",
          "py-0 pr-1 pl-[10px] text-ink-3 focus-within:border-ink-3",
        )}
        data-testid={ZibbyHistoryPanelTestId.Search}
      >
        <Icon name="search" size="sm" />
        <input
          aria-label={searchLabel}
          className="min-w-0 flex-1 border-none bg-transparent font-sans text-[13px] text-ink outline-none placeholder:text-ink-3"
          data-testid={ZibbyHistoryPanelTestId.SearchInput}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              rowButtons()[0]?.focus();
            }
          }}
          placeholder={searchPlaceholder}
          type="text"
          value={query}
        />
        {query !== "" && (
          <ZibbyIconButton
            data-testid={ZibbyHistoryPanelTestId.SearchClear}
            icon="x"
            label={clearSearchLabel}
            onClick={() => onQueryChange("")}
            size="xs"
          />
        )}
      </label>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-2 pt-[2px] pb-3"
        data-testid={ZibbyHistoryPanelTestId.List}
        onKeyDown={onListKeyDown}
        ref={listRef}
      >
        {visible.length === 0 ? (
          <div
            className="px-[10px] py-6 text-center text-[13px] text-ink-3"
            data-testid={ZibbyHistoryPanelTestId.Empty}
          >
            {emptyLabel}
          </div>
        ) : (
          visible.map((group, gi) => (
            <div
              aria-labelledby={`${idBase}-g${gi}`}
              data-testid={`${ZibbyHistoryPanelTestId.Group}-${gi}`}
              key={group.label}
              role="group"
            >
              <div
                className="px-[10px] pt-3 pb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3"
                id={`${idBase}-g${gi}`}
              >
                {group.label}
              </div>
              {group.items.map((item) =>
                currentRenaming === item.id ? (
                  <RenameRow
                    item={item}
                    key={item.id}
                    label={renameInputLabel}
                    onCancel={() => setRenaming(null)}
                    onCommit={(next) => {
                      onRename?.(item.id, next);
                      setRenaming(null);
                    }}
                  />
                ) : (
                  <div
                    className={cn(
                      "group relative mb-px rounded-[9px] hover:bg-panel-2",
                      item.active && "bg-panel-2 shadow-[inset_0_0_0_1px_var(--color-line-2)]",
                    )}
                    data-testid={`${ZibbyHistoryPanelTestId.Row}-${item.id}`}
                    key={item.id}
                  >
                    <button
                      aria-current={item.active ? "true" : undefined}
                      className={cn(
                        "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-[10px] gap-y-[2px]",
                        "rounded-[9px] border-none bg-transparent px-[10px] py-2 text-left font-sans",
                        focusRingInset,
                      )}
                      data-testid={`${ZibbyHistoryPanelTestId.RowButton}-${item.id}`}
                      data-zibby-row=""
                      onClick={() => onOpen(item.id)}
                      onDoubleClick={onRename ? () => setRenaming(item.id) : undefined}
                      type="button"
                    >
                      <span
                        className="truncate text-[13.5px] font-medium text-ink"
                        data-testid={`${ZibbyHistoryPanelTestId.RowTitle}-${item.id}`}
                      >
                        <Highlighted query={query} text={item.title} />
                      </span>
                      <span
                        className="pt-[2px] font-mono text-[11px] text-ink-3"
                        data-testid={`${ZibbyHistoryPanelTestId.RowTime}-${item.id}`}
                      >
                        {item.time}
                      </span>
                      {item.snippet != null && item.snippet !== "" && (
                        <span
                          className="col-span-full truncate text-[12px] text-ink-3"
                          data-testid={`${ZibbyHistoryPanelTestId.RowSnippet}-${item.id}`}
                        >
                          <Highlighted query={query} text={item.snippet} />
                        </span>
                      )}
                    </button>
                    {(onRename || onDelete) && (
                      <span
                        className={cn(
                          "absolute top-[6px] right-[6px] flex gap-[2px] rounded-lg bg-panel-2 opacity-0",
                          "transition-opacity duration-100 motion-reduce:transition-none",
                          "group-hover:opacity-100 group-focus-within:opacity-100",
                        )}
                      >
                        {onRename && (
                          <ZibbyIconButton
                            data-testid={`${ZibbyHistoryPanelTestId.RenameButton}-${item.id}`}
                            icon="pen"
                            label={renameLabel(item.title)}
                            onClick={() => setRenaming(item.id)}
                            size="sm"
                          />
                        )}
                        {onDelete && (
                          <ZibbyIconButton
                            data-testid={`${ZibbyHistoryPanelTestId.DeleteButton}-${item.id}`}
                            icon="trash"
                            label={deleteLabel(item.title)}
                            onClick={() => onDelete(item.id)}
                            size="sm"
                          />
                        )}
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
          ))
        )}
      </div>

      {footer != null && (
        <div
          className="border-t border-line px-[18px] pt-[10px] pb-[14px] text-[11.5px] leading-[1.6] text-ink-3"
          data-testid={ZibbyHistoryPanelTestId.Footer}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
