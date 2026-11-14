import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";

export enum LauncherTileTestId {
  Grid = "launcher-grid",
  Root = "launcher-tile-root",
  Icon = "launcher-tile-icon",
  Label = "launcher-tile-label",
}

export interface LauncherGridProps {
  children?: React.ReactNode;
}

/** Launcher species: three equal columns of tiles. */
export function LauncherGrid({ children }: LauncherGridProps) {
  return (
    <div className="grid grid-cols-3 gap-[4px] p-[4px]" data-testid={LauncherTileTestId.Grid}>
      {children}
    </div>
  );
}

export interface LauncherTileProps {
  icon: IconName;
  label: string;
  /** Extra accessible/tooltip text (e.g. the pin's kind). */
  title?: string;
  /** Unique row key (`data-rk`). */
  rowKey?: string;
  onClick: () => void;
}

/** A 36px icon tile with its label underneath. */
export function LauncherTile({ icon, label, title, rowKey, onClick }: LauncherTileProps) {
  return (
    <button
      className={cn(
        "flex min-w-0 cursor-pointer appearance-none flex-col items-center gap-[6px] rounded-[9px] px-[2px] py-[9px] text-center text-meta text-ink-2 hover:bg-panel-2 hover:text-ink",
        focusRing,
      )}
      data-rk={rowKey}
      data-testid={LauncherTileTestId.Root}
      onClick={onClick}
      title={title}
      type="button"
    >
      <span
        className="grid size-[36px] place-items-center rounded-[10px] border border-line bg-panel-2 text-ink"
        data-testid={LauncherTileTestId.Icon}
      >
        <Icon name={icon} size="md" />
      </span>
      <span className="w-full truncate" data-testid={LauncherTileTestId.Label}>
        {label}
      </span>
    </button>
  );
}
