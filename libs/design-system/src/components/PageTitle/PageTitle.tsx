import type { ReactNode, Ref } from "react";

export enum PageTitleTestId {
  Root = "page-title-root",
}

export interface PageTitleProps {
  /** Sentence case ("Bridge"), never caps. */
  children: ReactNode;
  ref?: Ref<HTMLHeadingElement>;
}

/** A screen's `h1` in the `title-l` type step (22 / 28 / 600), padded like the board under it. */
export function PageTitle({ children, ref }: PageTitleProps) {
  return (
    <h1
      className="m-0 px-[var(--bridge-bp)] pt-[var(--bridge-bp)] font-sans text-title-l text-ink"
      data-testid={PageTitleTestId.Root}
      ref={ref}
    >
      {children}
    </h1>
  );
}
