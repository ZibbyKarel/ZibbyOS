import type { ReactNode, Ref } from "react";

export enum RegistryListTestId {
  Root = "registry-list-root",
  Bar = "registry-list-bar",
}

export interface RegistryListProps {
  /** Terminal chrome: three dots and this mono title above the rows (Commands). */
  terminalTitle?: string;
  /** Dashed instead of solid row separators (terminal look). */
  dashed?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Seznamy registry density list: a bordered, rounded container whose `RegistryRow`
 * children are separated by hairlines. Optional terminal title bar.
 */
export function RegistryList({ terminalTitle, dashed, children, ref }: RegistryListProps) {
  return (
    <div
      className="overflow-hidden rounded-[12px] border border-line bg-panel"
      data-testid={RegistryListTestId.Root}
      ref={ref}
    >
      {terminalTitle && (
        <div
          aria-hidden="true"
          className="flex h-[34px] items-center gap-[6px] border-b border-line bg-code-bg px-[14px] font-mono text-[11px] text-ink-3"
          data-testid={RegistryListTestId.Bar}
        >
          <i className="size-[9px] rounded-full bg-line-2" />
          <i className="size-[9px] rounded-full bg-line-2" />
          <i className="size-[9px] rounded-full bg-line-2" />
          <span className="ml-[6px]">{terminalTitle}</span>
        </div>
      )}
      <ul
        className={`m-0 list-none p-0 ${dashed ? "[&>li+li]:border-t [&>li+li]:border-dashed [&>li+li]:border-line-2" : "[&>li+li]:border-t [&>li+li]:border-line"}`}
      >
        {children}
      </ul>
    </div>
  );
}
