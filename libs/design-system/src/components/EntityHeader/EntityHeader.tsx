import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum EntityHeaderTestId {
  Root = "entity-header-root",
  Title = "entity-header-title",
  Aside = "entity-header-aside",
}

export type EntityHeaderVariant = "company" | "project" | "team";

export interface EntityHeaderProps {
  /** `company` = editorial (huge title, warm glow), `project` = operational, `team` = knowledge. */
  variant: EntityHeaderVariant;
  /** Logo / icon tile on the left. */
  mark: ReactNode;
  /** Small line above the title (type chip, parent, code owner...). */
  eyebrow?: ReactNode;
  title: string;
  /** Mono caption beside the title (the repo remote). */
  titleMeta?: string;
  lede?: ReactNode;
  /** Chips row under the title (CI, PRs, branch...). */
  chips?: ReactNode;
  /** One-sentence summary ("4 integrations connected, 1 needs attention"). */
  summary?: ReactNode;
  /** Right-hand block: budget gauge / run pulse / knowledge vault. */
  aside?: ReactNode;
  /** Edit / run / overflow actions, top right. */
  actions?: ReactNode;
  ref?: Ref<HTMLElement>;
}

const pad: Record<EntityHeaderVariant, string> = {
  company:
    "gap-[28px] px-[28px] pt-[36px] pb-[30px] bg-[radial-gradient(90%_160%_at_0%_0%,color-mix(in_srgb,var(--color-accent)_7%,transparent),transparent_60%)]",
  project: "gap-[22px] px-[28px] pt-[20px] pb-[18px]",
  team: "gap-[22px] px-[28px] pt-[24px] pb-[20px]",
};

/** Identity header shared by Company / Project / Team (design `.hx`): one grid, three silhouettes. */
export function EntityHeader({
  variant,
  mark,
  eyebrow,
  title,
  titleMeta,
  lede,
  chips,
  summary,
  aside,
  actions,
  ref,
}: EntityHeaderProps) {
  return (
    <header
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center border-b border-line",
        aside
          ? "lg:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
          : "lg:grid-cols-[auto_minmax(0,1fr)_auto]",
        pad[variant],
      )}
      data-testid={EntityHeaderTestId.Root}
      ref={ref}
    >
      {mark}
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-[8px] flex items-center gap-[8px] text-[12px] text-ink-3">
            {eyebrow}
          </div>
        )}
        <h1
          className={cn(
            "m-0 flex flex-wrap items-baseline gap-[10px] font-sans",
            variant === "company"
              ? "text-[42px] leading-[1.05] font-medium tracking-[-0.045em]"
              : "text-[26px] font-semibold tracking-[-0.03em]",
          )}
          data-testid={EntityHeaderTestId.Title}
        >
          {title}
          {titleMeta && (
            <small className="font-mono text-[12px] font-normal tracking-normal text-ink-3">
              {titleMeta}
            </small>
          )}
        </h1>
        {lede && (
          <p className="mt-[6px] mb-0 max-w-[620px] text-[14px] leading-[1.5] text-ink-2">{lede}</p>
        )}
        {chips && <div className="mt-[10px] flex flex-wrap gap-[6px]">{chips}</div>}
        {summary && (
          <div className="mt-[12px] flex flex-wrap items-center gap-[8px] text-[13px] text-ink-2">
            {summary}
          </div>
        )}
      </div>
      {aside && <div data-testid={EntityHeaderTestId.Aside}>{aside}</div>}
      {actions && <div className="flex gap-[6px] self-start">{actions}</div>}
    </header>
  );
}

export enum EntityLogoTestId {
  Root = "entity-logo-root",
}

export interface EntityLogoProps {
  /** Up to two letters, shown big. */
  initials: string;
  /** The entity's uploaded logo; replaces the initials when present. */
  src?: string;
}

/** The 108px company logo block (design `.co-logo`) — initials until a real logo exists. */
export function EntityLogo({ initials, src }: EntityLogoProps) {
  return (
    <span
      className="grid h-[108px] w-[108px] place-items-center rounded-[28px] border border-line-2 bg-panel-2 text-[40px] font-semibold tracking-[-0.07em] text-ink shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-ink)_6%,transparent)]"
      data-testid={EntityLogoTestId.Root}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data-URI logo, no optimisation
        <img alt="" className="h-full w-full rounded-[28px] object-cover" src={src} />
      ) : (
        initials.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
