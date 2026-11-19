import type { Ref } from "react";
import { Icon } from "../Icon/Icon";
import type { IconName } from "../Icon/Icon";

export enum ListEmptyRowTestId {
  Root = "list-empty-row-root",
}

export interface ListEmptyRowProps {
  text: string;
  icon?: IconName;
  ref?: Ref<HTMLDivElement>;
}

/** Dashed single-row placeholder for an empty group (design `.pj-emp`). */
export function ListEmptyRow({ text, icon = "file", ref }: ListEmptyRowProps) {
  return (
    <div
      className="flex items-center gap-[12px] rounded-[12px] border border-dashed border-line-2 p-[18px] text-[13px] text-ink-3"
      data-testid={ListEmptyRowTestId.Root}
      ref={ref}
    >
      <Icon name={icon} size="sm" />
      {text}
    </div>
  );
}
