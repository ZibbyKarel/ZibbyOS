import type { ReactNode, Ref } from "react";
import { Icon } from "../Icon/Icon";
import type { IconName } from "../Icon/Icon";
import { EngineGlyph } from "../EngineBadge/EngineBadge";
import { Monogram } from "../Monogram/Monogram";

export enum PortraitCardTestId {
  Root = "portrait-card-root",
  Band = "portrait-card-band",
  Avatar = "portrait-card-avatar",
  Status = "portrait-card-status",
  Tag = "portrait-card-tag",
  Engine = "portrait-card-engine",
  Name = "portrait-card-name",
  Role = "portrait-card-role",
  Now = "portrait-card-now",
  Model = "portrait-card-model",
  Effort = "portrait-card-effort",
  Tools = "portrait-card-tools",
  Chips = "portrait-card-chips",
  Stats = "portrait-card-stats",
  Stat = "portrait-card-stat",
}

export interface PortraitCardStat {
  value: string;
  label: string;
}

export interface PortraitCardProps {
  name: string;
  /** Colour of the top band (a CSS colour, usually the department colour). */
  hue?: string;
  /** Top-left slot, e.g. a status pill. */
  status?: ReactNode;
  /** Top-right mono tag, e.g. the department code. */
  tag?: string;
  /** Short mono engine mark on the avatar (an engine id such as "claude" shows its icon; any other text shows as-is); its `engineLabel` is the accessible name. */
  engine?: string;
  engineLabel?: string;
  /** Icon avatar: a `hue`-tinted tile with this glyph instead of the name monogram. */
  glyph?: IconName;
  role?: string;
  /** "Právě: …" line; `tone` colours it (violet = working, sky = thinking). */
  now?: { text: string; tone: "run" | "think" };
  model?: string;
  /** Reasoning effort: 1-3 filled bars + a label. */
  effort?: { level: 0 | 1 | 2 | 3; label: string };
  /** Tool glyph tiles. */
  tools?: ReactNode[];
  /** Extra chips under the tools (app-only badges such as "used in N workflows"). */
  chips?: ReactNode;
  /** Three-cell stats strip; omitted when absent. */
  stats?: PortraitCardStat[];
  onClick?: () => void;
  ariaLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}

const nowTone = { run: "text-run", think: "text-state-think" } as const;

/** Portrait card (design `.ag`): coloured band, large monogram with an engine mark, name, role, model chips, tools and a stats strip. */
export function PortraitCard({
  name,
  hue = "var(--color-ink-3)",
  status,
  tag,
  engine,
  engineLabel,
  glyph,
  role,
  now,
  model,
  effort,
  tools,
  chips,
  stats,
  onClick,
  ariaLabel,
  ref,
}: PortraitCardProps) {
  return (
    <button
      aria-label={ariaLabel ?? name}
      className="relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-[12px] border border-line bg-panel p-0 text-left transition-[border-color] hover:border-line-2 focus-visible:outline-2 focus-visible:outline-accent"
      data-testid={PortraitCardTestId.Root}
      onClick={onClick}
      ref={ref}
      type="button"
    >
      <span
        className="relative block h-[118px] rounded-t-[11px] border-b border-line"
        data-testid={PortraitCardTestId.Band}
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${hue} 20%, transparent), color-mix(in srgb, ${hue} 4%, transparent))`,
        }}
      >
        {status && (
          <span className="absolute top-[10px] left-[10px]" data-testid={PortraitCardTestId.Status}>
            {status}
          </span>
        )}
        {tag && (
          <span
            className="absolute top-[12px] right-[12px] font-mono text-[10.5px] text-ink-3"
            data-testid={PortraitCardTestId.Tag}
          >
            {tag}
          </span>
        )}
        <span
          className="absolute bottom-[14px] left-1/2 -translate-x-1/2 rounded-[30%] shadow-[0_0_0_4px_var(--color-panel)]"
          data-testid={PortraitCardTestId.Avatar}
        >
          {glyph ? (
            <span
              className="grid size-[76px] place-items-center rounded-[30%] border border-line text-ink [&_svg]:size-[36px]"
              style={{ background: `color-mix(in srgb, ${hue} 22%, var(--color-panel))` }}
            >
              <Icon name={glyph} />
            </span>
          ) : (
            <Monogram name={name} size={76} />
          )}
          {engine && (
            <span
              aria-label={engineLabel}
              className="absolute right-[-8px] bottom-[-2px] inline-grid h-[22px] min-w-[22px] place-items-center rounded-[6px] border border-line-2 bg-raised px-[3px] font-mono text-[10px] leading-none font-semibold text-ink shadow-[0_0_0_3px_var(--color-panel)]"
              data-testid={PortraitCardTestId.Engine}
              role="img"
              title={engineLabel}
            >
              <EngineGlyph engine={engine} />
            </span>
          )}
        </span>
      </span>
      <span className="flex flex-1 flex-col items-center gap-[10px] px-[14px] pt-[14px] pb-[14px] text-center">
        <span className="block min-w-0 max-w-full">
          <span
            className="block truncate text-[16px] leading-[1.3] font-semibold tracking-[-0.015em] text-ink"
            data-testid={PortraitCardTestId.Name}
          >
            {name}
          </span>
          {role && (
            <span
              className="mt-[2px] line-clamp-2 text-[12.5px] text-ink-3"
              data-testid={PortraitCardTestId.Role}
            >
              {role}
            </span>
          )}
        </span>
        {now && (
          <span
            className={`block max-w-full truncate text-[12px] ${nowTone[now.tone]}`}
            data-testid={PortraitCardTestId.Now}
          >
            {now.text}
          </span>
        )}
        {(model || effort) && (
          <span className="flex flex-wrap justify-center gap-[6px]">
            {model && (
              <span
                className="inline-flex h-[22px] items-center rounded-[6px] bg-ink/[0.05] px-[8px] font-mono text-[11px] text-ink-2"
                data-testid={PortraitCardTestId.Model}
              >
                {model}
              </span>
            )}
            {effort && (
              <span
                className="inline-flex h-[22px] items-center gap-[6px] rounded-[6px] bg-ink/[0.05] px-[8px] text-[11px] text-ink-2"
                data-level={effort.level}
                data-testid={PortraitCardTestId.Effort}
              >
                <span aria-hidden="true" className="inline-flex h-[10px] items-end gap-[2px]">
                  {[1, 2, 3].map((n) => (
                    <i
                      className={`block w-[3px] rounded-[1px] ${n <= effort.level ? "bg-ink-2" : "bg-ink/20"}`}
                      key={n}
                      style={{ height: 3 + n * 2 }}
                    />
                  ))}
                </span>
                {effort.label}
              </span>
            )}
          </span>
        )}
        {tools && tools.length > 0 && (
          <span className="flex gap-[4px]" data-testid={PortraitCardTestId.Tools}>
            {tools.map((tool, i) => (
              <span
                className="grid size-[26px] place-items-center rounded-[7px] bg-ink/[0.05] text-ink-2"
                key={i}
              >
                {tool}
              </span>
            ))}
          </span>
        )}
        {chips && (
          <span
            className="flex flex-wrap justify-center gap-[6px]"
            data-testid={PortraitCardTestId.Chips}
          >
            {chips}
          </span>
        )}
      </span>
      {stats && stats.length > 0 && (
        <span
          className="mt-auto grid grid-cols-3 border-t border-line"
          data-testid={PortraitCardTestId.Stats}
        >
          {stats.map((s) => (
            <span
              className="border-line px-[6px] py-[9px] text-center text-[10.5px] text-ink-3 not-first:border-l"
              data-testid={PortraitCardTestId.Stat}
              key={s.label}
            >
              <b className="block font-mono text-[13px] font-medium text-ink">{s.value}</b>
              {s.label}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
