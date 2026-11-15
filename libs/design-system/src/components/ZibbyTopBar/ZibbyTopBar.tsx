"use client";
import { type KeyboardEvent, type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { buttonClasses } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import { Kbd } from "../Kbd/Kbd";

export enum ZibbyTopBarTestId {
  Root = "zibby-top-bar-root",
  HistoryButton = "zibby-top-bar-history-button",
  Title = "zibby-top-bar-title",
  TitleInput = "zibby-top-bar-title-input",
  Actions = "zibby-top-bar-actions",
}

export interface ZibbyTopBarProps {
  /** Conversation title. */
  title: string;
  /** Commit a new title (trimmed, non-empty, changed). Absent makes the title read-only. */
  onRename?: (next: string) => void;
  /** Controlled rename mode — lets a menu item start editing. Omit for internal state. */
  renaming?: boolean;
  onRenamingChange?: (renaming: boolean) => void;
  historyOpen: boolean;
  onHistoryToggle: () => void;
  /** Label of the history button (icon-only on phones, but always its accessible name). */
  historyLabel?: string;
  /** Shortcut hint shown inside the history button, e.g. "⌥ H". */
  historyKbd?: ReactNode;
  /** `id` of the history panel, wired to `aria-controls`. */
  historyControls?: string;
  /** Tooltip of the title button. */
  renameHint?: string;
  /** Accessible name of the inline title input. */
  titleInputLabel?: string;
  /** Right-aligned slot — "New conversation", the ⋯ menu, close. */
  actions?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

const titleBase =
  "absolute left-1/2 -translate-x-1/2 text-[13.5px] max-w-[min(520px,calc(100%_-_440px))] @max-[560px]:max-w-[calc(100%_-_260px)]";

interface TitleInputProps {
  initial: string;
  label: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}

function TitleInput({ initial, label, onCommit, onCancel }: TitleInputProps) {
  const [draft, setDraft] = useState(initial);
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
    if (commit && next !== "" && next !== initial) onCommit(next);
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
    <input
      aria-label={label}
      className={cn(
        titleBase,
        "h-8 w-[420px] rounded-lg border border-ink-3 bg-panel px-3 text-center font-sans text-ink",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent",
      )}
      data-testid={ZibbyTopBarTestId.TitleInput}
      onBlur={() => finish(true)}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      ref={ref}
      value={draft}
    />
  );
}

/**
 * The overlay's top-bar content (`.ztop`, 60 px): history toggle on the left, the conversation
 * title (click to rename inline) centred, and an `actions` slot on the right. Positioning and
 * fade-in belong to the overlay frame; this renders the row itself.
 */
export function ZibbyTopBar({
  title,
  onRename,
  renaming,
  onRenamingChange,
  historyOpen,
  onHistoryToggle,
  historyLabel = "History",
  historyKbd,
  historyControls,
  renameHint = "Rename",
  titleInputLabel = "Conversation title",
  actions,
  ref,
}: ZibbyTopBarProps) {
  const [innerRenaming, setInnerRenaming] = useState(false);
  const isRenaming = (renaming ?? innerRenaming) && onRename != null;
  const setRenaming = (next: boolean) => {
    if (renaming === undefined) setInnerRenaming(next);
    onRenamingChange?.(next);
  };

  return (
    <div
      className="@container relative flex h-[60px] w-full items-center gap-2 px-[18px] font-sans"
      data-testid={ZibbyTopBarTestId.Root}
      ref={ref}
    >
      <button
        aria-controls={historyControls}
        aria-expanded={historyOpen}
        aria-label={historyLabel}
        className={cn(
          buttonClasses({ intent: "secondary", size: "sm" }),
          historyOpen && "border-ink-3 bg-raised",
        )}
        data-testid={ZibbyTopBarTestId.HistoryButton}
        onClick={onHistoryToggle}
        type="button"
      >
        <Icon name="layout" size="xs" stroke="medium" />
        <span className="@max-[560px]:hidden">{historyLabel}</span>
        {historyKbd != null && (
          <span className="@max-[560px]:hidden">
            <Kbd>{historyKbd}</Kbd>
          </span>
        )}
      </button>

      {isRenaming ? (
        <TitleInput
          initial={title}
          label={titleInputLabel}
          onCancel={() => setRenaming(false)}
          onCommit={(next) => {
            onRename?.(next);
            setRenaming(false);
          }}
        />
      ) : onRename ? (
        <button
          className={cn(
            titleBase,
            "cursor-pointer truncate rounded-lg border-none bg-transparent px-[10px] py-[5px] text-center font-sans font-medium text-ink-2",
            "transition-colors hover:bg-panel-2 hover:text-ink motion-reduce:transition-none",
            focusRing,
          )}
          data-testid={ZibbyTopBarTestId.Title}
          onClick={() => setRenaming(true)}
          title={renameHint}
          type="button"
        >
          {title}
        </button>
      ) : (
        <span
          className={cn(
            titleBase,
            "truncate px-[10px] py-[5px] text-center font-medium text-ink-2",
          )}
          data-testid={ZibbyTopBarTestId.Title}
        >
          {title}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2" data-testid={ZibbyTopBarTestId.Actions}>
        {actions}
      </div>
    </div>
  );
}
