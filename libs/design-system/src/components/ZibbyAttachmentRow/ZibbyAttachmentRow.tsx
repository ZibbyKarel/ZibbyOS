import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum ZibbyAttachmentRowTestId {
  Root = "zibby-attachment-row-root",
}

export interface ZibbyAttachmentRowProps {
  /** `ZibbyAttachmentChip`s. */
  children?: ReactNode;
  /** Horizontal alignment of the wrapping row. Default `start`. */
  align?: "start" | "end";
  /** Accessible name; when set the row becomes a labelled group. */
  label?: string;
  "data-testid"?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Wrapping row of attachment chips (`.zat`, `.zat.in` = `align="end"`). Outer margins are the consumer's. */
export function ZibbyAttachmentRow({
  children,
  align = "start",
  label,
  "data-testid": testId = ZibbyAttachmentRowTestId.Root,
  ref,
}: ZibbyAttachmentRowProps) {
  return (
    <div
      aria-label={label}
      className={cn("flex flex-wrap gap-[6px]", align === "end" && "justify-end")}
      data-testid={testId}
      ref={ref}
      role={label ? "group" : undefined}
    >
      {children}
    </div>
  );
}
