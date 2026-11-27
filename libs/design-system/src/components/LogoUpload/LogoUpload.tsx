"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useRef } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Button } from "../Button/Button";
import { IconTile } from "../IconTile/IconTile";

export enum LogoUploadTestId {
  Root = "logo-upload-root",
  Change = "logo-upload-change",
  Input = "logo-upload-input",
  Remove = "logo-upload-remove",
}

export interface LogoUploadProps {
  /** Current logo (data URI / path); the `fallback` shows when absent or broken. */
  src?: string;
  alt?: string;
  /** Placeholder shown without a logo — e.g. the entity's initials. */
  fallback: ReactNode;
  /** Label of the hover overlay button, e.g. "Change logo". */
  changeLabel: string;
  /** Label of the remove action; the action only renders when `onRemove` is given and a logo exists. */
  removeLabel?: string;
  /** Comma-separated `accept` list of the file picker. */
  accept?: string;
  /** Called with the picked file (validation/reading is the caller's job). */
  onSelect: (file: File) => void;
  onRemove?: () => void;
}

/**
 * The editable logo of an entity: the current logo (or `fallback`) with a
 * "change" overlay revealed on hover and keyboard focus. The overlay is a real
 * labelled `<button>` that opens a hidden file picker, so it works by keyboard
 * and touch too (always visible to assistive tech, only the visuals fade).
 */
export function LogoUpload({
  src,
  alt,
  fallback,
  changeLabel,
  removeLabel,
  accept = "image/png,image/jpeg,image/webp,image/svg+xml",
  onSelect,
  onRemove,
}: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (file) onSelect(file);
  }

  return (
    <div className="flex items-center gap-3" data-testid={LogoUploadTestId.Root}>
      <span className="group relative inline-grid">
        <IconTile alt={alt} size="xl" src={src} style={{ width: 96, height: 96 }} tone="neutral">
          <span className="text-[32px] font-semibold tracking-[-0.05em] text-ink">{fallback}</span>
        </IconTile>
        <button
          aria-label={changeLabel}
          className={cn(
            "absolute inset-0 grid cursor-pointer place-items-center rounded-sm bg-bg/75 px-2 text-center text-[12px] font-medium text-ink opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none",
            focusRing,
          )}
          data-testid={LogoUploadTestId.Change}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {changeLabel}
        </button>
        <input
          hidden
          accept={accept}
          data-testid={LogoUploadTestId.Input}
          onChange={handleChange}
          ref={inputRef}
          tabIndex={-1}
          type="file"
        />
      </span>
      {src && onRemove && removeLabel && (
        <Button
          data-testid={LogoUploadTestId.Remove}
          icon="trash"
          intent="danger"
          onClick={onRemove}
          size="sm"
        >
          {removeLabel}
        </Button>
      )}
    </div>
  );
}
