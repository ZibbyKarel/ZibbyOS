import type { Ref } from "react";
import { cn } from "../../utils/cn";
import { Typography } from "../Typography/Typography";

export enum WordmarkTestId {
  Root = "wordmark-root",
  Name = "wordmark-name",
  Dot = "wordmark-dot",
  Version = "wordmark-version",
}

export type WordmarkSize = "sm" | "md" | "lg";

export interface WordmarkProps {
  /** Overrides the default `zibby.` lettering. Rendered as written, without the dot. */
  children?: string;
  /** Optional small second line under the name, e.g. the running release `v0.2.1`. */
  version?: string;
  /** `sm` = compact app header (14.5px / 600), `md` = 20px, `lg` = splash (34px, 44px from `md` up). */
  size?: WordmarkSize;
  ref?: Ref<HTMLElement>;
}

const SIZE_CLASS: Record<WordmarkSize, string> = {
  sm: "text-[14.5px] font-semibold",
  md: "text-[20px] font-bold",
  lg: "text-[34px] md:text-[44px] font-bold",
};

/**
 * The ZibbyOS wordmark (`design/brand/ZibbyCorp – Brand.html`): lowercase
 * `zibby` in Geist 700, −0.065em, closed by the amber "sentence dot" — the
 * butler's "Done." The dot is amber text, so it uses `--color-accent-fg`.
 * Its accessible name stays the product name, `ZibbyOS`.
 */
export function Wordmark({ children, version, size = "md", ref }: WordmarkProps) {
  const name = children ?? "ZibbyOS";
  return (
    <span
      aria-label={version ? `${name} ${version}` : name}
      className="inline-flex flex-col"
      data-testid={WordmarkTestId.Root}
      ref={ref}
    >
      <span
        aria-hidden="true"
        className={cn("font-sans leading-none tracking-[-0.065em] text-ink", SIZE_CLASS[size])}
        data-testid={WordmarkTestId.Name}
      >
        {children ?? (
          <>
            zibby
            <span className="text-accent-fg" data-testid={WordmarkTestId.Dot}>
              .
            </span>
          </>
        )}
      </span>
      {version && (
        <Typography data-testid={WordmarkTestId.Version} leading="tight" type="micro">
          {version}
        </Typography>
      )}
    </span>
  );
}
