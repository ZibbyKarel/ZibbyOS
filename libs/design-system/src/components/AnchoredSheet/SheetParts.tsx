import type { ReactNode } from "react";
import type { IconName } from "../../assets/icons";
import { cn } from "../../utils/cn";
import { Icon } from "../Icon/Icon";

export enum SheetPartsTestId {
  Banner = "sheet-banner",
  BannerActions = "sheet-banner-actions",
  Section = "sheet-section",
  Columns = "sheet-columns",
  Block = "sheet-block",
  BlockLabel = "sheet-block-label",
  Text = "sheet-text",
  Action = "sheet-action",
}

/** Body section: padding 18/20, 22px between blocks. */
export function SheetSection({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col gap-[22px] px-[20px] py-[18px]"
      data-testid={SheetPartsTestId.Section}
    >
      {children}
    </div>
  );
}

/** Two responsive columns (auto-fit, min 300px) — each child is a column of `SheetBlock`s. */
export function SheetColumns({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-[28px] gap-y-[22px] px-[20px] py-[18px] [&>*]:flex [&>*]:min-w-0 [&>*]:flex-col [&>*]:gap-[22px]"
      data-testid={SheetPartsTestId.Columns}
    >
      {children}
    </div>
  );
}

/** A labelled block: sentence-case 12 / 500 label (Bridge `.sxs h4`) over its content (8px apart). */
export function SheetBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[8px]" data-testid={SheetPartsTestId.Block}>
      <span
        className="font-sans text-[12px] font-medium text-ink-2"
        data-testid={SheetPartsTestId.BlockLabel}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** Body copy: 14 / 1.45, one paragraph per line. */
export function SheetText({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <p
          className="m-0 text-[14px] leading-[1.45] [text-wrap:pretty]"
          data-testid={SheetPartsTestId.Text}
          key={`${i}-${l}`}
        >
          {l}
        </p>
      ))}
    </>
  );
}

export interface SheetBannerProps {
  /** `error` = rose, `blocked` = amber (needs me), `done` = emerald (briefly, after an action). */
  tone: "error" | "blocked" | "done";
  icon: IconName;
  title: ReactNode;
  text?: ReactNode;
  /** Buttons at the right. */
  actions?: ReactNode;
}

const BANNER: Record<SheetBannerProps["tone"], { bg: string; icon: string }> = {
  error: {
    bg: "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-state-err)_10%,transparent),color-mix(in_srgb,var(--color-state-err)_3%,transparent))]",
    icon: "text-state-err",
  },
  blocked: {
    bg: "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-accent)_12%,transparent),color-mix(in_srgb,var(--color-accent)_4%,transparent))] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-accent)_35%,transparent)]",
    icon: "text-accent-fg",
  },
  done: {
    bg: "bg-[color-mix(in_srgb,var(--color-state-done)_7%,transparent)]",
    icon: "text-state-done",
  },
};

/** The sheet's one banner (AnchoredSheet `banner` slot): tone icon · bold title + note · actions. */
export function SheetBanner({ tone, icon, title, text, actions }: SheetBannerProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-[10px] border-b border-line px-[18px] py-[12px] text-[13px] text-ink",
        BANNER[tone].bg,
      )}
      data-testid={SheetPartsTestId.Banner}
      data-tone={tone}
      role={tone === "done" ? "status" : "alert"}
    >
      <span className={cn("mt-[2px]", BANNER[tone].icon)}>
        <Icon name={icon} size="md" />
      </span>
      <div className="min-w-0">
        <b className="font-semibold">{title}</b>
        {text ? <p className="m-0 mt-[2px] text-[12.5px] text-ink-2">{text}</p> : null}
      </div>
      {actions ? (
        <div
          className="flex flex-wrap items-center gap-[6px]"
          data-testid={SheetPartsTestId.BannerActions}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export interface SheetActionProps {
  /** `ghost` = 1px outline; `primary` = filled ink. */
  intent?: "ghost" | "primary";
  /** Renders an `<a target=_blank>` when set, a `<button>` otherwise. */
  href?: string;
  onClick?: () => void;
  /** Dimmed to 35% + `not-allowed`; a button gets `aria-disabled` and ignores clicks. */
  disabled?: boolean;
  title?: string;
  children: ReactNode;
  "data-testid"?: string;
}

/** A footer action in the sheet's mono style (reference `OPEN ON GITHUB ↗`, `PROCESS INTO A TASK`, …). */
export function SheetAction({
  intent = "ghost",
  href,
  onClick,
  disabled = false,
  title,
  children,
  "data-testid": testId,
}: SheetActionProps) {
  const cls = cn(
    "whitespace-nowrap rounded-md font-medium no-underline transition-colors",
    intent === "primary"
      ? "border border-accent bg-accent px-[14px] py-[7px] text-accent-contrast"
      : "border border-line-2 bg-panel px-[12px] py-[7px] text-ink hover:bg-hover",
    disabled
      ? "cursor-not-allowed opacity-35 hover:bg-transparent hover:text-ink-2"
      : "cursor-pointer",
  );
  return href && !disabled ? (
    <a
      className={cls}
      data-testid={testId ?? SheetPartsTestId.Action}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      title={title}
    >
      {children}
    </a>
  ) : (
    <button
      aria-disabled={disabled || undefined}
      className={cls}
      data-testid={testId ?? SheetPartsTestId.Action}
      onClick={disabled ? undefined : onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}
