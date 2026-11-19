import type { Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon } from "../Icon/Icon";
import type { IconName } from "../../assets/icons";

export enum ConnectionRibbonTestId {
  Root = "connection-ribbon-root",
  Item = "connection-ribbon-item",
}

export interface ConnectionRibbonItem {
  /** Small mono kicker ("Company", "Team", "Project"). */
  kind: string;
  label: string;
  icon: IconName;
  /** The level this page sits on — drawn as the filled ink pill. */
  current?: boolean;
  onSelect?: () => void;
}

export interface ConnectionRibbonProps {
  items: ConnectionRibbonItem[];
  ariaLabel?: string;
  ref?: Ref<HTMLElement>;
}

/** The inheritance ribbon (design `.rib`): Company › Team › Project, the current level inked. */
export function ConnectionRibbon({ items, ariaLabel, ref }: ConnectionRibbonProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="inline-flex h-[28px] items-center gap-px rounded-full border border-line-2 bg-bg p-[2px] text-[12px]"
      data-testid={ConnectionRibbonTestId.Root}
      ref={ref}
    >
      {items.map((it, i) => {
        const cls = cn(
          "inline-flex h-[22px] items-center gap-[6px] rounded-full pr-[10px] pl-[8px] whitespace-nowrap",
          it.current ? "bg-ink font-medium text-on-ink" : "text-ink-2",
          !it.current &&
            it.onSelect &&
            cn("cursor-pointer hover:bg-panel-2 hover:text-ink", focusRing),
        );
        const inner = (
          <>
            <Icon name={it.icon} size="xs" />
            <span className="font-mono text-[9.5px] tracking-[0.08em] uppercase opacity-75">
              {it.kind}
            </span>
            {it.label}
          </>
        );
        return (
          <span className="inline-flex items-center gap-px" key={`${it.kind}-${it.label}`}>
            {i > 0 && (
              <span aria-hidden="true" className="inline-flex text-ink-3">
                <Icon name="chevron" size="xs" />
              </span>
            )}
            {it.onSelect && !it.current ? (
              <button
                className={cls}
                data-testid={ConnectionRibbonTestId.Item}
                onClick={it.onSelect}
                type="button"
              >
                {inner}
              </button>
            ) : (
              <span
                aria-current={it.current ? "page" : undefined}
                className={cls}
                data-testid={ConnectionRibbonTestId.Item}
              >
                {inner}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
