import type { ReactNode, Ref } from "react";

export enum DenseRowTestId {
  List = "dense-row-list",
  Root = "dense-row-root",
  Title = "dense-row-title",
  Cell = "dense-row-cell",
  Trailing = "dense-row-trailing",
}

export interface DenseRowListProps {
  children: ReactNode;
  ref?: Ref<HTMLUListElement>;
}

/** Bordered list frame for {@link DenseRow}s (design `.rg-list`). */
export function DenseRowList({ children, ref }: DenseRowListProps) {
  return (
    <ul
      className="m-0 list-none divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-panel p-0"
      data-testid={DenseRowTestId.List}
      ref={ref}
    >
      {children}
    </ul>
  );
}

export interface DenseRowProps {
  /** Leading status dot. */
  dot?: ReactNode;
  title: string;
  /** Faint second line under the title (e.g. a description). */
  hint?: string;
  /** Called when the title is activated (opens the detail). */
  onOpen?: () => void;
  /** Middle cells (e.g. schedule, last fired); the first is the wider one. */
  cells?: ReactNode[];
  /** Right end: switch, quick actions. */
  trailing?: ReactNode;
  testId?: string;
  ref?: Ref<HTMLLIElement>;
}

/** One dense list row (design `.au-r`): dot, name, two mono cells and a trailing control; stacks on a phone. */
export function DenseRow({
  dot,
  title,
  hint,
  onOpen,
  cells,
  trailing,
  testId,
  ref,
}: DenseRowProps) {
  return (
    <li
      className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-[14px] gap-y-[4px] px-[16px] py-[11px] text-[13px] md:grid-cols-[10px_minmax(0,1fr)_220px_150px_auto]"
      data-testid={testId ?? DenseRowTestId.Root}
      ref={ref}
    >
      <span className="grid place-items-center">{dot}</span>
      <span className="min-w-0 font-medium text-ink" data-testid={DenseRowTestId.Title}>
        {onOpen ? (
          <button
            className="max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left font-medium text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            onClick={onOpen}
            type="button"
          >
            {title}
          </button>
        ) : (
          <span className="block truncate">{title}</span>
        )}
        {hint && (
          <span className="block truncate text-[11.5px] font-normal text-ink-3">{hint}</span>
        )}
      </span>
      {cells?.map((c, i) => (
        <span
          className="col-start-2 min-w-0 text-[12.5px] text-ink-2 md:col-start-auto"
          data-testid={DenseRowTestId.Cell}
          key={i}
        >
          {c}
        </span>
      ))}
      {trailing && (
        <span
          className="col-start-3 row-start-1 flex items-center justify-end gap-[8px] md:col-start-auto md:row-start-auto"
          data-testid={DenseRowTestId.Trailing}
        >
          {trailing}
        </span>
      )}
    </li>
  );
}
