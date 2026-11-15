import type { ReactNode, Ref } from "react";

export enum ZibbyThreadEmptyTestId {
  Root = "zibby-thread-empty-root",
}

export interface ZibbyThreadEmptyProps {
  /** The hint text. */
  children?: ReactNode;
  "data-testid"?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Centred muted hint of an empty thread (`.zempty`). Centres itself inside a flex column. */
export function ZibbyThreadEmpty({
  children,
  "data-testid": testId = ZibbyThreadEmptyTestId.Root,
  ref,
}: ZibbyThreadEmptyProps) {
  return (
    <div
      className="m-auto max-w-[420px] text-center text-[14px] leading-[1.55] text-ink-3"
      data-testid={testId}
      ref={ref}
    >
      {children}
    </div>
  );
}
