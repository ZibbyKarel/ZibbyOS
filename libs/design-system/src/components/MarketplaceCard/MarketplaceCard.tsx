import type { HTMLAttributes, ReactNode, Ref } from "react";
import { Icon } from "../Icon/Icon";
import { PluginShelf } from "../PluginShelf/PluginShelf";

export enum MarketplaceCardTestId {
  Root = "marketplace-card-root",
  Open = "marketplace-card-open",
  Name = "marketplace-card-name",
  Kind = "marketplace-card-kind",
  Source = "marketplace-card-source",
  Installed = "marketplace-card-installed",
  Percent = "marketplace-card-percent",
  Bar = "marketplace-card-bar",
  Footer = "marketplace-card-footer",
}

export interface MarketplaceCardProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "title"
> {
  name: string;
  /** `"dev"` gets the dashed tag, `"regular"` the filled one. */
  kind: "dev" | "regular";
  kindLabel: string;
  /** Git remote / source line. */
  source: string;
  installed: number;
  total: number;
  /** Text node(s) around the bold installed count, e.g. `["Nainstalováno ", " z 12 pluginů"]`. */
  installedText: [before: string, after: string];
  /** Footer action(s), right-aligned (e.g. the "Browse" button). */
  footer?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * `Seznamy.dc.html` → Marketplace shelf card: shelf of plugin boxes on top, then mono
 * name + type tag, the git remote, an "installed X of Y" line with a bar, and a footer.
 */
export function MarketplaceCard({
  name,
  kind,
  kindLabel,
  source,
  installed,
  total,
  installedText,
  footer,
  onOpen,
  openLabel,
  ref,
  ...rest
}: MarketplaceCardProps) {
  const pct = total > 0 ? Math.round((installed / total) * 100) : 0;
  return (
    <div
      className="relative flex min-w-0 flex-col rounded-[12px] border border-line bg-panel transition-colors hover:border-line-2"
      data-testid={MarketplaceCardTestId.Root}
      ref={ref}
      {...rest}
    >
      {onOpen && (
        <button
          aria-label={openLabel ?? name}
          className="absolute inset-0 z-[1] cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-accent"
          data-testid={MarketplaceCardTestId.Open}
          onClick={onOpen}
          type="button"
        />
      )}
      <PluginShelf installed={installed} total={total} />
      <div className="flex flex-col gap-[10px] px-[16px] py-[14px]">
        <div className="flex items-center gap-2">
          <h3
            className="m-0 min-w-0 flex-1 truncate font-mono text-[14px] font-medium text-ink"
            data-testid={MarketplaceCardTestId.Name}
          >
            {name}
          </h3>
          <span
            className={`rounded-[5px] px-[7px] py-[2px] text-[11px] font-medium ${
              kind === "dev"
                ? "border border-dashed border-ink-3 text-ink"
                : "bg-ink/[0.06] text-ink-2"
            }`}
            data-testid={MarketplaceCardTestId.Kind}
          >
            {kindLabel}
          </span>
        </div>
        <span
          className="inline-flex max-w-full items-center gap-[6px] self-start truncate font-mono text-[11.5px] text-ink-3"
          data-testid={MarketplaceCardTestId.Source}
        >
          <Icon name="branch" size="xs" />
          <span className="truncate">{source}</span>
        </span>
        <div>
          <div className="mb-[6px] flex justify-between text-[12px] text-ink-2">
            <span data-testid={MarketplaceCardTestId.Installed}>
              {installedText[0]}
              <b className="font-semibold text-ink">{installed}</b>
              {installedText[1]}
            </span>
            <span
              className="font-mono text-[11.5px] text-ink-3"
              data-testid={MarketplaceCardTestId.Percent}
            >
              {pct} %
            </span>
          </div>
          <span
            aria-label={`${installed}/${total}`}
            aria-valuemax={total}
            aria-valuemin={0}
            aria-valuenow={installed}
            className="block h-[5px] overflow-hidden rounded-full bg-ink/[0.08]"
            data-testid={MarketplaceCardTestId.Bar}
            role="meter"
          >
            <i className="block h-full rounded-full bg-ink-2" style={{ width: `${pct}%` }} />
          </span>
        </div>
      </div>
      {footer && (
        <div
          className="relative z-[2] mt-auto flex items-center justify-end gap-2 border-t border-line px-[16px] pt-[10px] pb-[12px]"
          data-testid={MarketplaceCardTestId.Footer}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
