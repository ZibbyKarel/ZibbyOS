import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";
import type { ZibbyStatus } from "../ZibbySection/ZibbySection";

export enum ZibbyStatusMenuTestId {
  Root = "zibby-status-menu-root",
  Head = "zibby-status-menu-head",
  Action = "zibby-status-menu-action",
  Link = "zibby-status-menu-link",
}

const headTone: Record<ZibbyStatus, string> = {
  paused: "bg-ink/[0.04]",
  run: "bg-state-work/10",
};

export interface ZibbyStatusMenuProps {
  status: ZibbyStatus;
  /** The big orb (pass `<ZibbyOrb size={52} />`). */
  orb: ReactNode;
  /** Accessible name of the orb, e.g. "Zibby thinks". */
  orbLabel: string;
  /** "Running" */
  title: string;
  /** " · Zibby thinks" (muted, after the title). */
  state: string;
  /** One line on what the status means. */
  description: string;
  /** The pause/resume button and links, in order. */
  children: ReactNode;
  /** Bottom-sheet layout: the head is a framed card and the rows are taller. */
  sheet?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The body of the Zibby status popover (desktop) and bottom sheet (phone): a status head (orb,
 * title, description) over the caller's `ZibbyStatusAction` and `ZibbyStatusLink`s.
 */
export function ZibbyStatusMenu({
  status,
  orb,
  orbLabel,
  title,
  state,
  description,
  children,
  sheet = false,
  ref,
}: ZibbyStatusMenuProps) {
  return (
    <div data-sheet={sheet || undefined} data-testid={ZibbyStatusMenuTestId.Root} ref={ref}>
      <div
        className={cn(
          "flex items-center gap-4 px-3.5 pt-4 pb-3.5",
          headTone[status],
          sheet ? "mb-2.5 rounded-xl border border-line" : "mb-1.5 border-b border-line",
        )}
        data-testid={ZibbyStatusMenuTestId.Head}
      >
        <span aria-label={orbLabel} role="img">
          {orb}
        </span>
        <span>
          <b className="block text-[14.5px] font-semibold tracking-[-0.01em]">
            {title}
            <span className="font-normal text-ink-2">{state}</span>
          </b>
          <small className="mt-0.5 block text-[12px] leading-[1.45] text-ink-2">
            {description}
          </small>
        </span>
      </div>
      <div className={cn("flex flex-col gap-1", sheet ? "" : "p-1.5 pt-0")}>{children}</div>
    </div>
  );
}

export interface ZibbyStatusActionProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "type" | "children"
> {
  /** Resuming (a solid button) instead of pausing (an outline one). */
  resume?: boolean;
  label: string;
  /** What happens next, under the label. */
  hint: string;
  ref?: Ref<HTMLButtonElement>;
}

/** The big Pause / Resume button of the status menu. */
export function ZibbyStatusAction({
  resume = false,
  label,
  hint,
  ref,
  ...rest
}: ZibbyStatusActionProps) {
  return (
    <button
      className={cn(
        "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-[11px] text-left font-sans text-[13px] font-medium",
        "transition-colors disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none",
        resume
          ? "border-ink bg-ink text-bg hover:opacity-90"
          : "border-line-2 bg-transparent text-ink hover:bg-panel-2",
        focusRingInset,
      )}
      data-testid={ZibbyStatusMenuTestId.Action}
      ref={ref}
      type="button"
      {...rest}
    >
      <Icon name={resume ? "play" : "pause"} size="md" stroke="medium" />
      <span>
        {label}
        <small
          className={cn(
            "mt-px block text-[11.5px] font-normal",
            resume ? "text-bg/75" : "text-ink-3",
          )}
        >
          {hint}
        </small>
      </span>
    </button>
  );
}

export interface ZibbyStatusLinkProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "type" | "children"
> {
  /** Leading glyph name, or a custom node (e.g. an attention dot). */
  icon: IconName | ReactNode;
  label: string;
  /** Muted second line. */
  hint?: string;
  /** Tinted row: something waits on the operator. */
  highlight?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** A navigation row of the status menu: glyph, label, optional hint and a chevron. */
export function ZibbyStatusLink({
  icon,
  label,
  hint,
  highlight = false,
  ref,
  ...rest
}: ZibbyStatusLinkProps) {
  return (
    <button
      className={cn(
        "flex min-h-[38px] w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] text-left font-sans text-[12.5px] text-ink hover:bg-panel-2",
        highlight && "bg-ink/[0.04]",
        focusRingInset,
      )}
      data-testid={ZibbyStatusMenuTestId.Link}
      ref={ref}
      type="button"
      {...rest}
    >
      {typeof icon === "string" ? <Icon name={icon as IconName} size="md" /> : icon}
      <span className="flex-1">
        {label}
        {hint && <small className="block text-[11.5px] text-ink-3">{hint}</small>}
      </span>
      <Icon name="chevron" size="sm" />
    </button>
  );
}
