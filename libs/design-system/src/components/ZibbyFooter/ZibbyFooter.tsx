import type { ReactNode, Ref } from "react";

export enum ZibbyFooterTestId {
  Root = "zibby-footer-root",
  Start = "zibby-footer-start",
  End = "zibby-footer-end",
}

export interface ZibbyFooterProps {
  /** Items at the start of the row (mode switch, mute toggle …). */
  start?: ReactNode;
  /** Items pushed to the far end (shortcut hints …). */
  end?: ReactNode;
  "data-testid"?: string;
  ref?: Ref<HTMLDivElement>;
}

/** The wrapping row of small muted items under the composer (`.zft`). */
export function ZibbyFooter({
  start,
  end,
  "data-testid": testId = ZibbyFooterTestId.Root,
  ref,
}: ZibbyFooterProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-[10px] text-[12px] text-ink-3"
      data-testid={testId}
      ref={ref}
    >
      {start ? (
        <span className="contents" data-testid={ZibbyFooterTestId.Start}>
          {start}
        </span>
      ) : null}
      <span aria-hidden="true" className="flex-1" />
      {end ? (
        <span className="contents" data-testid={ZibbyFooterTestId.End}>
          {end}
        </span>
      ) : null}
    </div>
  );
}
