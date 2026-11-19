import type { Ref } from "react";

export enum CodeTileTestId {
  Root = "code-tile-root",
}

export interface CodeTileProps {
  /** Department code, e.g. "ENG". */
  code: string;
  /** `ink` = solid inverse monogram (company card) instead of the outlined plate. */
  solid?: boolean;
  /** `sm` = 22px chip (org-chart root monogram). */
  size?: "md" | "sm";
  ref?: Ref<HTMLSpanElement>;
}

/** Big mono "door-plate" tile with a department code (design `.dp-code`). */
export function CodeTile({ code, solid = false, size = "md", ref }: CodeTileProps) {
  return (
    <span
      className={
        size === "sm"
          ? "grid size-[22px] shrink-0 place-items-center rounded-[6px] bg-ink text-[9px] font-bold text-bg"
          : solid
            ? "grid size-[50px] shrink-0 place-items-center rounded-[14px] bg-ink text-[17px] font-bold tracking-[-0.04em] text-bg"
            : "grid size-[50px] shrink-0 place-items-center rounded-[12px] border border-line-2 bg-raised font-mono text-[14px] font-semibold tracking-[0.02em] text-ink"
      }
      data-testid={CodeTileTestId.Root}
      ref={ref}
    >
      {code}
    </span>
  );
}
