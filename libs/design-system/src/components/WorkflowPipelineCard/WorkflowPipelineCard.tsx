import type { ReactNode, Ref } from "react";
import { Icon } from "../Icon/Icon";
import { EngineGlyph } from "../EngineBadge/EngineBadge";
import { Monogram } from "../Monogram/Monogram";

export enum WorkflowPipelineCardTestId {
  Root = "workflow-pipeline-card-root",
  Info = "workflow-pipeline-card-info",
  Title = "workflow-pipeline-card-title",
  Description = "workflow-pipeline-card-description",
  Meta = "workflow-pipeline-card-meta",
  Last = "workflow-pipeline-card-last",
  Pipeline = "workflow-pipeline-card-pipeline",
  Node = "workflow-pipeline-card-node",
  Connector = "workflow-pipeline-card-connector",
  Output = "workflow-pipeline-card-output",
}

export interface WorkflowPipelineNode {
  id: string;
  /** Mono ordinal shown top-left ("01"). */
  index: string;
  name: string;
  /** Agent (or sub-workflow) name; omitted for system/tool phases. */
  who?: string;
  /** Engine id ("claude", "openai", …) shown as its icon; other text shows as-is. */
  engine?: string;
  /** `done` shows a tick and a solid arrow, `active` is ringed violet. */
  state?: "idle" | "done" | "active";
}

export interface WorkflowPipelineCardProps {
  /** Left tile (an icon or avatar). */
  icon: ReactNode;
  title: string;
  description?: string;
  /** Row under the description (department tag, "N phases"). */
  meta?: ReactNode;
  /** Bottom line of the info column (last run: dot, time, duration; cost on the right). */
  last?: ReactNode;
  nodes: WorkflowPipelineNode[];
  /** Terminal sink pill after the last node. */
  output?: { label: string; icon?: ReactNode };
  onClick?: () => void;
  ariaLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}

const nodeClass = {
  idle: "bg-panel border-line-2",
  done: "bg-panel/70 border-line-2",
  active:
    "bg-panel border-run/65 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-run)_14%,transparent)]",
} as const;

/** Horizontal workflow card (design `.wf`): info column plus a node pipeline on a dotted grid; scrolls under the info on a phone. */
export function WorkflowPipelineCard({
  icon,
  title,
  description,
  meta,
  last,
  nodes,
  output,
  onClick,
  ariaLabel,
  ref,
}: WorkflowPipelineCardProps) {
  return (
    <button
      aria-label={ariaLabel ?? title}
      className="grid min-w-0 cursor-pointer grid-cols-1 overflow-hidden rounded-[12px] border border-line bg-panel p-0 text-left transition-[border-color] hover:border-line-2 focus-visible:outline-2 focus-visible:outline-accent md:grid-cols-[300px_minmax(0,1fr)]"
      data-testid={WorkflowPipelineCardTestId.Root}
      onClick={onClick}
      ref={ref}
      type="button"
    >
      <span
        className="flex flex-col gap-[10px] border-b border-line p-[18px] md:border-r md:border-b-0"
        data-testid={WorkflowPipelineCardTestId.Info}
      >
        <span className="flex items-center gap-[10px]">
          <span className="grid size-[32px] shrink-0 place-items-center rounded-[9px] border border-line-2 bg-raised text-ink">
            {icon}
          </span>
          <span
            className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.015em] text-ink"
            data-testid={WorkflowPipelineCardTestId.Title}
          >
            {title}
          </span>
        </span>
        {description && (
          <span
            className="line-clamp-3 text-[12.5px] leading-[1.5] text-ink-2"
            data-testid={WorkflowPipelineCardTestId.Description}
          >
            {description}
          </span>
        )}
        {meta && (
          <span
            className="flex flex-wrap items-center gap-[8px] text-[11.5px] text-ink-3"
            data-testid={WorkflowPipelineCardTestId.Meta}
          >
            {meta}
          </span>
        )}
        {last && (
          <span
            className="mt-auto flex items-center gap-[7px] border-t border-line pt-[10px] text-[12px] text-ink-2"
            data-testid={WorkflowPipelineCardTestId.Last}
          >
            {last}
          </span>
        )}
      </span>
      <span
        className="flex items-center overflow-x-auto px-[22px] py-[20px] [background-image:radial-gradient(color-mix(in_srgb,var(--color-ink)_11%,transparent)_1px,transparent_1.2px)] [background-size:16px_16px]"
        data-testid={WorkflowPipelineCardTestId.Pipeline}
      >
        <span className="flex min-w-max items-center">
          {nodes.map((n, i) => {
            const state = n.state ?? "idle";
            return (
              <span className="flex items-center" key={n.id}>
                <span
                  className={`flex w-[150px] flex-col gap-[7px] rounded-[10px] border px-[11px] py-[10px] ${nodeClass[state]}`}
                  data-state={state}
                  data-testid={WorkflowPipelineCardTestId.Node}
                >
                  <span className="flex items-center gap-[6px] font-mono text-[10px] text-ink-3">
                    {n.index}
                    {state === "done" && <Icon name="check" size="xs" tone="ok" />}
                    {state === "active" && (
                      <span
                        aria-hidden="true"
                        className="size-[7px] animate-pulse rounded-full bg-run motion-reduce:animate-none"
                      />
                    )}
                  </span>
                  <span className="truncate text-[13px] font-medium text-ink">{n.name}</span>
                  {n.who && (
                    <span className="flex min-w-0 items-center gap-[6px]">
                      <Monogram name={n.who} size={18} />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                        {n.who}
                      </span>
                      {n.engine && (
                        <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-line-2 bg-raised px-[3px] font-mono text-[8px] leading-none font-semibold text-ink">
                          <EngineGlyph engine={n.engine} />
                        </span>
                      )}
                    </span>
                  )}
                </span>
                {(i < nodes.length - 1 || output) && (
                  <span
                    aria-hidden="true"
                    className={`relative mr-[6px] h-[2px] w-[30px] shrink-0 after:absolute after:top-[-4px] after:right-[-6px] after:border-y-[5px] after:border-l-[6px] after:border-y-transparent ${
                      state === "done"
                        ? "bg-ink-3 after:border-l-ink-3"
                        : "bg-line-2 after:border-l-line-2"
                    }`}
                    data-testid={WorkflowPipelineCardTestId.Connector}
                  />
                )}
              </span>
            );
          })}
          {output && (
            <span
              className="inline-flex h-[32px] items-center gap-[6px] rounded-full border border-dashed border-line-2 bg-panel px-[13px] text-[12px] whitespace-nowrap text-ink-2"
              data-testid={WorkflowPipelineCardTestId.Output}
            >
              {output.icon}
              {output.label}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
