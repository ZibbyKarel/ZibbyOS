import type { Ref } from "react";
import { Icon } from "../Icon/Icon";

export enum ZibbyAttachmentChipTestId {
  Root = "zibby-attachment-chip-root",
  Image = "zibby-attachment-chip-image",
  Tile = "zibby-attachment-chip-tile",
  Name = "zibby-attachment-chip-name",
  Size = "zibby-attachment-chip-size",
  Remove = "zibby-attachment-chip-remove",
}

export type ZibbyAttachmentKind = "image" | "pdf" | "code" | "sheet" | "file";

const kindLabel: Record<ZibbyAttachmentKind, string> = {
  image: "IMG",
  pdf: "PDF",
  code: "</>",
  sheet: "XLS",
  file: "FILE",
};

export interface ZibbyAttachmentChipProps {
  /** File name (ellipsised when long). */
  name: string;
  /** Type of the file; picks the mono tile label. Default `file`. */
  kind?: ZibbyAttachmentKind;
  /** Thumbnail URL; with `kind="image"` renders a 26 px image instead of the tile. */
  src?: string;
  /** Pre-formatted size text, e.g. "48 kB". */
  sizeLabel?: string;
  /** Shows a remove button when set. */
  onRemove?: () => void;
  /** Accessible name of the remove button. Default `"Remove <name>"`. */
  removeLabel?: string;
  "data-testid"?: string;
  ref?: Ref<HTMLSpanElement>;
}

/** One attached file (`.zat-c`). */
export function ZibbyAttachmentChip({
  name,
  kind = "file",
  src,
  sizeLabel,
  onRemove,
  removeLabel,
  "data-testid": testId = ZibbyAttachmentChipTestId.Root,
  ref,
}: ZibbyAttachmentChipProps) {
  return (
    <span
      className="inline-flex h-[34px] max-w-[280px] items-center gap-2 rounded-[9px] border border-line-2 bg-panel-2 pl-1 pr-[6px] text-[12.5px] text-ink [.zibby-me-bubble_&]:bg-panel"
      data-testid={testId}
      ref={ref}
    >
      {kind === "image" && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-[26px] w-[26px] flex-none rounded-[6px] object-cover"
          data-testid={ZibbyAttachmentChipTestId.Image}
          src={src}
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-[26px] w-[26px] flex-none place-items-center rounded-[6px] bg-raised font-mono text-[9px] font-semibold text-ink-2"
          data-testid={ZibbyAttachmentChipTestId.Tile}
        >
          {kindLabel[kind]}
        </span>
      )}
      <span
        className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
        data-testid={ZibbyAttachmentChipTestId.Name}
        title={name}
      >
        {name}
      </span>
      {sizeLabel ? (
        <span
          className="whitespace-nowrap font-mono text-[11px] text-ink-3"
          data-testid={ZibbyAttachmentChipTestId.Size}
        >
          {sizeLabel}
        </span>
      ) : null}
      {onRemove ? (
        <button
          aria-label={removeLabel ?? `Remove ${name}`}
          className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[6px] text-ink-3 outline-none hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
          data-testid={ZibbyAttachmentChipTestId.Remove}
          onClick={onRemove}
          type="button"
        >
          <Icon name="x" size="sm" />
        </button>
      ) : null}
    </span>
  );
}
