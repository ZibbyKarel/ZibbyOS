import type { ReactNode, Ref } from "react";
import { Icon, type IconName } from "../Icon/Icon";

export enum DecisionCardTestId {
  Root = "decision-card-root",
  Context = "decision-card-context",
  Title = "decision-card-title",
  Body = "decision-card-body",
  Actions = "decision-card-actions",
}

export interface DecisionCardProps {
  /** The context line above the title (where it came from, when). Phrasing content. */
  context: ReactNode;
  /** Glyph leading the context line. Default `spark`. */
  icon?: IconName;
  /** The decision being asked for; may be replaced by an inline editor. */
  title: ReactNode;
  /** Rationale and supporting meta below the title. */
  children?: ReactNode;
  /** Decision buttons (primary first); omitted while the card is being edited. */
  actions?: ReactNode;
  ref?: Ref<HTMLElement>;
}

/**
 * A decision card (species `decisionCards`): context line, title, rationale, actions. A raised
 * `panel-2` surface with a `line-2` edge; colour only comes from the actions' state.
 */
export function DecisionCard({
  context,
  icon = "spark",
  title,
  children,
  actions,
  ref,
}: DecisionCardProps) {
  return (
    <article
      className="mx-[10px] mt-[2px] mb-[6px] flex flex-col gap-[4px] rounded-[10px] border border-line-2 bg-panel-2 p-[14px]"
      data-testid={DecisionCardTestId.Root}
      ref={ref}
    >
      <div
        className="flex min-w-0 flex-wrap items-center gap-[6px] text-[11.5px] text-ink-3"
        data-testid={DecisionCardTestId.Context}
      >
        <Icon name={icon} size="xs" />
        {context}
      </div>
      <div className="mt-[2px]" data-testid={DecisionCardTestId.Title}>
        {title}
      </div>
      {children ? (
        <div className="flex flex-col gap-[6px]" data-testid={DecisionCardTestId.Body}>
          {children}
        </div>
      ) : null}
      {actions ? (
        <div className="mt-[8px] flex flex-wrap gap-[6px]" data-testid={DecisionCardTestId.Actions}>
          {actions}
        </div>
      ) : null}
    </article>
  );
}
