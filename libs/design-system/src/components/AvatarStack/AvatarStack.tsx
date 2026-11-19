import type { Ref } from "react";

export enum AvatarStackTestId {
  Root = "avatar-stack-root",
  Item = "avatar-stack-item",
  More = "avatar-stack-more",
  Label = "avatar-stack-label",
}

export interface AvatarStackItem {
  name: string;
  src?: string;
}

export interface AvatarStackProps {
  items: readonly AvatarStackItem[];
  /** Avatars shown before collapsing the rest into a `+N` bubble. */
  max?: number;
  /** Trailing label ("14 osob"). */
  label?: string;
  /** Overlapping stack (company card) or spaced row with a dashed `+N` (team card). */
  spread?: boolean;
  ref?: Ref<HTMLDivElement>;
}

const TINTS = ["bg-run/30", "bg-ok/30", "bg-warn/30", "bg-bad/25", "bg-accent/30"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") +
    (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? ""))
  ).trim();
}

function tint(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length] ?? "bg-run/30";
}

/** Round initials avatars in a row (design `.co-ppl` / `.tm-people`) with an optional count label. */
export function AvatarStack({ items, max = 4, label, spread = false, ref }: AvatarStackProps) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  const size = spread ? "size-[34px] text-[12px]" : "size-[26px] text-[10.5px]";
  return (
    <div className="flex items-center gap-[10px]" data-testid={AvatarStackTestId.Root} ref={ref}>
      <span className={spread ? "flex items-center gap-[5px]" : "flex items-center -space-x-[6px]"}>
        {shown.map((p, i) => (
          <span
            className={`grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-ink ${size} ${tint(p.name)} ${spread ? "" : "ring-2 ring-panel"}`}
            data-testid={AvatarStackTestId.Item}
            key={`${p.name}-${i}`}
            title={p.name}
          >
            {p.src ? (
              <img alt="" className="size-full object-cover" src={p.src} />
            ) : (
              initials(p.name)
            )}
          </span>
        ))}
        {spread && rest > 0 && (
          <span
            className={`grid shrink-0 place-items-center rounded-full border border-dashed border-line-2 font-semibold text-ink-2 ${size}`}
            data-testid={AvatarStackTestId.More}
          >
            +{rest}
          </span>
        )}
      </span>
      {label && (
        <span className="text-[12.5px] text-ink-2" data-testid={AvatarStackTestId.Label}>
          {label}
        </span>
      )}
    </div>
  );
}
