import type { ReactNode, Ref } from "react";

export enum ListHeaderTestId {
  Root = "list-header-root",
  Crumb = "list-header-crumb",
  Title = "list-header-title",
  Count = "list-header-count",
  Actions = "list-header-actions",
}

export interface ListHeaderTone {
  text: string;
  /** Colour of a live fragment: violet = running, amber = waits for you, rose = failed. */
  tone: "run" | "warn" | "bad" | "plain";
}

export interface ListHeaderProps {
  /** Section label before the route, e.g. "Organizace". */
  section: string;
  /** Route shown mono after the section, e.g. "/companies". */
  route: string;
  title: string;
  /** Count line fragments joined by " · "; a coloured fragment marks live state. */
  count: ListHeaderTone[];
  /** Right-aligned buttons (secondary actions then the ink primary). */
  actions?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

const toneClass: Record<ListHeaderTone["tone"], string> = {
  plain: "",
  run: "font-medium text-run",
  warn: "font-medium text-warn",
  bad: "font-medium text-bad",
};

/** Shared list-page header: breadcrumb `Section / /route`, h1, coloured live count line, action slot. */
export function ListHeader({ section, route, title, count, actions, ref }: ListHeaderProps) {
  return (
    <div
      className="flex flex-wrap items-end gap-[10px]"
      data-testid={ListHeaderTestId.Root}
      ref={ref}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-[6px] text-[12px] text-ink-3" data-testid={ListHeaderTestId.Crumb}>
          {section} / <span className="font-mono">{route}</span>
        </div>
        <h1
          className="m-0 text-[26px] leading-[1.15] font-semibold tracking-[-0.03em] text-ink"
          data-testid={ListHeaderTestId.Title}
        >
          {title}
        </h1>
        <p
          className="mt-[5px] mb-0 min-h-[20px] text-[13px] text-ink-3"
          data-testid={ListHeaderTestId.Count}
        >
          {count.map((c, i) => (
            <span key={`${c.text}-${i}`}>
              {i > 0 && " · "}
              <span className={toneClass[c.tone]}>{c.text}</span>
            </span>
          ))}
        </p>
      </div>
      {actions && (
        <div className="flex items-center gap-2" data-testid={ListHeaderTestId.Actions}>
          {actions}
        </div>
      )}
    </div>
  );
}
