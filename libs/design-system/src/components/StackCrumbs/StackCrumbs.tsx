import { cn } from "../../utils/cn";
import type { SheetTone } from "../AnchoredSheet/sheetTone";

const toneDot: Record<SheetTone, string> = {
  working: "bg-state-work",
  thinking: "bg-state-think",
  blocked: "bg-state-block",
  error: "bg-state-err",
  done: "bg-state-done",
  idle: "bg-state-idle",
  neutral: "bg-line-2",
  faint: "bg-line-2",
};

export enum StackCrumbsTestId {
  Root = "stack-crumbs-root",
  Label = "stack-crumbs-label",
  /** Suffixed with the crumb id. */
  Crumb = "stack-crumbs-crumb",
}

export interface StackCrumb {
  id: string;
  label: string;
  /** State dot of the crumb. */
  tone?: SheetTone;
  /** The open item: raised fill + stronger border. */
  current?: boolean;
  /** Makes the crumb a button (e.g. open that item). */
  onSelect?: () => void;
}

export interface StackCrumbsProps {
  /** Caption before the trail, e.g. `Stack`. */
  label: string;
  crumbs: readonly StackCrumb[];
}

const crumbClass = (c: StackCrumb) =>
  cn(
    "inline-flex h-[22px] items-center gap-[5px] rounded-sm border px-[7px] font-mono text-mono",
    c.current ? "border-line-2 bg-panel-2 text-ink" : "border-transparent text-ink-2",
  );

const dot = (c: StackCrumb) => (
  <span
    aria-hidden="true"
    className={cn("size-[6px] shrink-0 rounded-full", toneDot[c.tone ?? "idle"])}
  />
);

/** `Stack  #1 → #2 → #3` breadcrumb with a state dot per crumb; the current crumb is raised. */
export function StackCrumbs({ label, crumbs }: StackCrumbsProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-[4px] text-meta"
      data-testid={StackCrumbsTestId.Root}
    >
      <span className="mr-[4px] text-meta text-ink-3" data-testid={StackCrumbsTestId.Label}>
        {label}
      </span>
      {crumbs.map((c, i) => (
        <span className="contents" key={c.id}>
          {c.onSelect ? (
            <button
              className={cn(crumbClass(c), "cursor-pointer hover:bg-panel-2 hover:text-ink")}
              data-testid={`${StackCrumbsTestId.Crumb}-${c.id}`}
              onClick={c.onSelect}
              type="button"
            >
              {dot(c)}
              {c.label}
            </button>
          ) : (
            <span className={crumbClass(c)} data-testid={`${StackCrumbsTestId.Crumb}-${c.id}`}>
              {dot(c)}
              {c.label}
            </span>
          )}
          {i < crumbs.length - 1 ? <span className="text-ink-3">→</span> : null}
        </span>
      ))}
    </div>
  );
}
