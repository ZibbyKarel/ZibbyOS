import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Icon } from "../Icon/Icon";

export enum BoardSectionTestId {
  Root = "board-section-root",
  Label = "board-section-label",
  Count = "board-section-count",
}

export interface BoardSectionProps {
  label: string;
  /** Mono count after the label. */
  count?: string;
  /** `accent` = needs the operator (amber text). */
  tone?: "default" | "accent";
  /** With `onToggle` the divider is a disclosure button. */
  closed?: boolean;
  onToggle?: () => void;
}

/** In-widget section divider (`overline` voice + hairline), e.g. "Parked 02". Optionally collapses its section. */
export function BoardSection({
  label,
  count,
  tone = "default",
  closed = false,
  onToggle,
}: BoardSectionProps) {
  const Tag = onToggle ? "button" : "div";
  return (
    <Tag
      aria-expanded={onToggle ? !closed : undefined}
      className={cn(
        "flex w-full items-center gap-[8px] px-[16px] pb-[4px] pt-[12px] text-left text-overline uppercase",
        tone === "accent" ? "text-accent-fg" : "text-ink-3",
        onToggle && cn("cursor-pointer appearance-none", focusRingInset),
      )}
      data-testid={BoardSectionTestId.Root}
      onClick={onToggle}
      type={onToggle ? "button" : undefined}
    >
      <span data-testid={BoardSectionTestId.Label}>{label}</span>
      {count ? (
        <span className="font-mono tracking-normal" data-testid={BoardSectionTestId.Count}>
          {count}
        </span>
      ) : null}
      <span aria-hidden className="h-px flex-1 bg-line" />
      {onToggle ? (
        <span aria-hidden className={cn("flex transition-transform", closed && "-rotate-90")}>
          <Icon name="chevron" size="xs" />
        </span>
      ) : null}
    </Tag>
  );
}
