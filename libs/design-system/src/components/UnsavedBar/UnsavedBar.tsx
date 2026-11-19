import type { Ref } from "react";
import { Button } from "../Button/Button";
import { Kbd } from "../Kbd/Kbd";

export enum UnsavedBarTestId {
  Root = "unsaved-bar-root",
  Title = "unsaved-bar-title",
  Items = "unsaved-bar-items",
  Error = "unsaved-bar-error",
  Discard = "unsaved-bar-discard",
  Save = "unsaved-bar-save",
}

export interface UnsavedBarProps {
  /** Headline, e.g. "3 unsaved changes". */
  title: string;
  /** Names of the changed sections, listed after the headline. */
  items: readonly string[];
  discardLabel: string;
  saveLabel: string;
  /** Keyboard hint shown on the save button, e.g. "⌘S". Omit to hide it. */
  shortcut?: string;
  onDiscard: () => void;
  onSave: () => void;
  /** Save in flight — the save button spins and both buttons are disabled. */
  saving?: boolean;
  /** Blocks saving (e.g. a field is invalid). */
  saveDisabled?: boolean;
  /** Save failure shown in the bar; the changes stay kept. */
  error?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Sticky floating bar for draft-style forms: names what changed, offers Discard and
 * Save (with the Cmd+S hint). Pinned to the bottom centre of the viewport; render it
 * only while the form is dirty. Bridge `.ubar`.
 */
export function UnsavedBar({
  title,
  items,
  discardLabel,
  saveLabel,
  shortcut,
  onDiscard,
  onSave,
  saving = false,
  saveDisabled = false,
  error,
  ref,
}: UnsavedBarProps) {
  return (
    <div
      className="fixed bottom-[18px] left-1/2 z-20 flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-[6px] rounded-[12px] border border-line-2 bg-panel-2 py-[8px] pr-[8px] pl-[14px] text-[12.5px] shadow-[var(--shadow-pop)]"
      data-testid={UnsavedBarTestId.Root}
      ref={ref}
      role="status"
    >
      <div className="flex items-center gap-[12px]">
        <span aria-hidden="true" className="size-[6px] shrink-0 rounded-full bg-ink-2" />
        <span className="min-w-0 truncate">
          <b className="font-medium text-ink" data-testid={UnsavedBarTestId.Title}>
            {title}
          </b>
          {items.length > 0 && (
            <span className="text-ink-3" data-testid={UnsavedBarTestId.Items}>
              {" · "}
              {items.join(", ")}
            </span>
          )}
        </span>
        <Button
          data-testid={UnsavedBarTestId.Discard}
          disabled={saving}
          intent="ghost"
          onClick={onDiscard}
          size="sm"
        >
          {discardLabel}
        </Button>
        <Button
          data-testid={UnsavedBarTestId.Save}
          disabled={saveDisabled || saving}
          loading={saving}
          onClick={onSave}
          size="sm"
        >
          {saveLabel}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </Button>
      </div>
      {error && (
        <span className="text-bad" data-testid={UnsavedBarTestId.Error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
