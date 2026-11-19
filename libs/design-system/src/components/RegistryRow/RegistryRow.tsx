import type { LiHTMLAttributes, ReactNode, Ref } from "react";

export enum RegistryRowTestId {
  Root = "registry-row-root",
  Open = "registry-row-open",
  Lead = "registry-row-lead",
  Main = "registry-row-main",
  Aside = "registry-row-aside",
  Trailing = "registry-row-trailing",
}

export interface RegistryRowProps extends Omit<LiHTMLAttributes<HTMLLIElement>, "className"> {
  /** Leading slot (prompt glyph, icon tile, event pill). */
  lead?: ReactNode;
  /** `"wide"` gives the lead a fixed column so rows align (hook events). */
  leadWidth?: "auto" | "wide";
  /** Middle content; grows. */
  children?: ReactNode;
  /** Secondary columns, hidden on phones. */
  aside?: ReactNode;
  /** Right edge; sits above the open target so switches / links stay clickable. */
  trailing?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
  ref?: Ref<HTMLLIElement>;
}

/**
 * One density row of a {@link RegistryList}: `lead · main · aside · trailing` on a
 * single line, hover tint, whole row opens its detail through a cover button.
 */
export function RegistryRow({
  lead,
  leadWidth = "auto",
  children,
  aside,
  trailing,
  onOpen,
  openLabel,
  ref,
  ...rest
}: RegistryRowProps) {
  return (
    <li
      className="relative flex items-center gap-[14px] px-4 py-[11px] transition-colors hover:bg-ink/[0.035]"
      data-testid={RegistryRowTestId.Root}
      ref={ref}
      {...rest}
    >
      {onOpen && (
        <button
          aria-label={openLabel}
          className="absolute inset-0 z-[1] cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
          data-testid={RegistryRowTestId.Open}
          onClick={onOpen}
          type="button"
        />
      )}
      {lead && (
        <span
          className={`shrink-0 ${leadWidth === "wide" ? "md:w-[240px]" : ""}`}
          data-testid={RegistryRowTestId.Lead}
        >
          {lead}
        </span>
      )}
      <div className="min-w-0 flex-1" data-testid={RegistryRowTestId.Main}>
        {children}
      </div>
      {aside && (
        <div
          className="hidden min-w-0 shrink-0 items-center gap-[14px] md:flex"
          data-testid={RegistryRowTestId.Aside}
        >
          {aside}
        </div>
      )}
      {trailing && (
        <div className="relative z-[2] shrink-0" data-testid={RegistryRowTestId.Trailing}>
          {trailing}
        </div>
      )}
    </li>
  );
}
