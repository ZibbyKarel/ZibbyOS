import type { HTMLAttributes, ReactNode, Ref } from "react";

export enum SkillTileTestId {
  Root = "skill-tile-root",
  Open = "skill-tile-open",
  Glyph = "skill-tile-glyph",
  Name = "skill-tile-name",
  Source = "skill-tile-source",
  Description = "skill-tile-description",
  Footer = "skill-tile-footer",
}

export interface SkillTileProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "title"
> {
  name: string;
  /** Small outlined badge top-right (source repo, marketplace, `lokální`, …). Pass a node for a custom badge. */
  source?: ReactNode;
  description?: string;
  /** Footer row under a hairline (e.g. "Napojeno na" + department codes). Sits above the open target. */
  footer?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * `Seznamy.dc.html` → Registry skills: a dense tile with a 2-letter mono glyph, mono
 * name, source badge, one-line description and a footer row.
 */
export function SkillTile({
  name,
  source,
  description,
  footer,
  onOpen,
  openLabel,
  ref,
  ...rest
}: SkillTileProps) {
  return (
    <div
      className="relative flex min-w-0 flex-col gap-2 rounded-[10px] border border-line bg-panel px-3 py-[11px] transition-colors hover:border-line-2"
      data-testid={SkillTileTestId.Root}
      ref={ref}
      {...rest}
    >
      {onOpen && (
        <button
          aria-label={openLabel ?? name}
          className="absolute inset-0 z-[1] cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-accent"
          data-testid={SkillTileTestId.Open}
          onClick={onOpen}
          type="button"
        />
      )}
      <div className="flex min-w-0 items-center gap-[9px]">
        <span
          aria-hidden="true"
          className="grid size-[26px] shrink-0 place-items-center rounded-[7px] border border-line bg-raised font-mono text-[10px] font-semibold text-ink-2"
          data-testid={SkillTileTestId.Glyph}
        >
          {name.slice(0, 2).toLowerCase()}
        </span>
        <b
          className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-medium text-ink"
          data-testid={SkillTileTestId.Name}
        >
          {name}
        </b>
        {source && (
          <span
            className="max-w-[46%] truncate rounded-[5px] border border-line px-[6px] py-px text-[10.5px] whitespace-nowrap text-ink-3"
            data-testid={SkillTileTestId.Source}
          >
            {source}
          </span>
        )}
      </div>
      {description && (
        <p
          className="m-0 truncate text-[12px] text-ink-3"
          data-testid={SkillTileTestId.Description}
        >
          {description}
        </p>
      )}
      {footer && (
        <div
          className="relative z-[2] flex flex-wrap items-center gap-1 border-t border-line pt-[7px] text-[10.5px] text-ink-3"
          data-testid={SkillTileTestId.Footer}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
