import type { CSSProperties, ReactNode } from "react";

export enum WidgetPlaceholderTestId {
  Root = "widget-placeholder-root",
}

export interface WidgetPlaceholderProps {
  /** Geometry inside a `WidgetBoard` (left / top / width / height in px). */
  style?: CSSProperties;
  /** The add affordance, centred in the ghost (e.g. an "Add widget" menu button). */
  children?: ReactNode;
}

/** A ghost widget slot: dashed outline in a `WidgetFrame`'s footprint, shown where a widget can be added. */
export function WidgetPlaceholder({ style, children }: WidgetPlaceholderProps) {
  return (
    <div
      className="absolute z-[1] flex items-center justify-center rounded-[10px] border border-dashed border-line-2 bg-ink/[0.025]"
      data-testid={WidgetPlaceholderTestId.Root}
      style={style}
    >
      {children}
    </div>
  );
}
