"use client";

import { Children, type ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { BridgeSelection } from "../../bridge/widgets/registry";
import { useOpenDetail } from "../../chat/chatDetail";
import {
  Button,
  Card,
  Container,
  Divider,
  type DotTone,
  Icon,
  Stack,
  StatusDot,
  type SubNavLinkComponent,
  TextLink,
  Typography,
} from "@zibby/design-system";

/** Next's `Link` as the DS `linkComponent` (client-side navigation, no DS router import). */
export const NEXT_LINK = Link as SubNavLinkComponent;

export enum ChatWidgetFrameTestId {
  Root = "chat-widget",
  Header = "chat-widget-header",
  Title = "chat-widget-title",
  Count = "chat-widget-count",
  OpenAll = "chat-widget-open-all",
  Rows = "chat-widget-rows",
  Row = "chat-widget-row",
  RowDot = "chat-widget-row-dot",
  RowLink = "chat-widget-row-link",
  RowStatus = "chat-widget-row-status",
  RowTrailing = "chat-widget-row-trailing",
  Loading = "chat-widget-loading",
  Empty = "chat-widget-empty",
  Error = "chat-widget-error",
  Retry = "chat-widget-retry",
  More = "chat-widget-more",
}

export type ChatWidgetStatus = "loading" | "error" | "empty" | "ready";

export interface ChatWidgetFrameProps {
  /** Header title (the widget's own `title`, else the localized default). */
  title: string;
  /** Total number of items behind the card (shown muted next to the title). */
  count?: number;
  /** The dashboard screen the "open all" link leads to; omitted = no link. */
  openHref?: string;
  status: ChatWidgetStatus;
  /** The one muted line shown when `status` is `empty`. */
  emptyText: string;
  /** Offered in the error state when set. */
  onRetry?: () => void;
  /** How many items did not fit under `limit`; > 0 renders the "+N more" link. */
  hiddenCount?: number;
  /** Where "+N more" leads; defaults to `openHref`. */
  moreHref?: string;
  /** Overrides the root test id so each card keeps its own enum. */
  rootTestId?: string;
  /** The rows (`ChatWidgetRow`) — or free content for non-list cards. When the
   * children are rows they are separated by hairlines. */
  children?: ReactNode;
}

/**
 * The shared frame of every inline chat widget — one visual family (`.zcard` in
 * `design/zibby/zibby.css`): a bordered 12 px panel on the raised surface, an optional
 * header (title · count · "open all"), hairline-separated rows, and the loading /
 * empty / error states. Kept as a local composite (built purely from DS primitives):
 * it is only used by the Zibby thread, so it is not promoted to the DS.
 */
export function ChatWidgetFrame({
  title,
  count,
  openHref,
  status,
  emptyText,
  onRetry,
  hiddenCount = 0,
  moreHref,
  rootTestId = ChatWidgetFrameTestId.Root,
  children,
}: ChatWidgetFrameProps) {
  const t = useTranslations("zibbyWidgets");
  const rows = Children.toArray(children);
  const moreLink = moreHref ?? openHref;

  return (
    <Card
      clip
      aria-busy={status === "loading"}
      aria-label={title}
      background="raised"
      data-testid={rootTestId}
      radius="lg"
      role="region"
    >
      <Stack direction="col">
        <Container padding={["100", "150"]}>
          <Stack
            align="center"
            data-testid={ChatWidgetFrameTestId.Header}
            direction="row"
            gap="100"
          >
            <Container grow minW0>
              <Stack align="baseline" direction="row" gap="75">
                <Typography
                  truncate
                  data-testid={ChatWidgetFrameTestId.Title}
                  size="sm"
                  type="note"
                  weight="semibold"
                >
                  {title}
                </Typography>
                {count !== undefined && count > 0 && (
                  <Typography
                    mono
                    data-testid={ChatWidgetFrameTestId.Count}
                    size="xs"
                    type="note"
                    variant="tertiary"
                  >
                    {count}
                  </Typography>
                )}
              </Stack>
            </Container>
            {openHref && (
              <TextLink
                aria-label={t("openAllAria", { title })}
                data-testid={ChatWidgetFrameTestId.OpenAll}
                href={openHref}
                linkComponent={NEXT_LINK}
              >
                <Stack align="center" direction="row" gap="50">
                  <Typography as="span" size="xs" type="note" variant="secondary">
                    {t("openAll")}
                  </Typography>
                  <Icon name="chevron" size="xs" tone="faint" />
                </Stack>
              </TextLink>
            )}
          </Stack>
        </Container>

        {status === "loading" && (
          <>
            <Divider />
            <Container
              aria-live="polite"
              data-testid={ChatWidgetFrameTestId.Loading}
              padding={["100", "150"]}
              role="status"
            >
              <Typography size="sm" type="note" variant="tertiary">
                {t("loading")}
              </Typography>
            </Container>
          </>
        )}

        {status === "error" && (
          <>
            <Divider />
            <Container padding={["100", "150"]}>
              <Stack align="center" direction="row" gap="100" justify="between">
                <Typography
                  data-testid={ChatWidgetFrameTestId.Error}
                  role="alert"
                  size="sm"
                  tone="bad"
                  type="note"
                >
                  {t("error")}
                </Typography>
                {onRetry && (
                  <Button
                    data-testid={ChatWidgetFrameTestId.Retry}
                    intent="ghost"
                    onClick={onRetry}
                    size="sm"
                  >
                    {t("retry")}
                  </Button>
                )}
              </Stack>
            </Container>
          </>
        )}

        {status === "empty" && (
          <>
            <Divider />
            <Container padding={["100", "150"]}>
              <Typography
                data-testid={ChatWidgetFrameTestId.Empty}
                size="sm"
                type="note"
                variant="tertiary"
              >
                {emptyText}
              </Typography>
            </Container>
          </>
        )}

        {status === "ready" && rows.length > 0 && (
          <Stack as="ul" data-testid={ChatWidgetFrameTestId.Rows} direction="col">
            {rows.map((row, i) => (
              <Stack as="li" direction="col" key={rowKey(row, i)}>
                <Divider />
                {row}
              </Stack>
            ))}
          </Stack>
        )}

        {status === "ready" && hiddenCount > 0 && moreLink && (
          <>
            <Divider />
            <Container padding={["100", "150"]}>
              <TextLink
                aria-label={t("moreAria", { count: hiddenCount, title })}
                data-testid={ChatWidgetFrameTestId.More}
                href={moreLink}
                linkComponent={NEXT_LINK}
              >
                <Typography as="span" size="xs" type="note" variant="secondary">
                  {t("more", { count: hiddenCount })}
                </Typography>
              </TextLink>
            </Container>
          </>
        )}
      </Stack>
    </Card>
  );
}

function rowKey(row: ReactNode, index: number): string {
  if (typeof row === "object" && row !== null && "key" in row && row.key !== null) {
    return String(row.key);
  }
  return String(index);
}

export interface ChatWidgetRowProps {
  /** Dot colour; the same state is always also spelled out in `statusLabel`. */
  tone: DotTone;
  /** Replaces the status dot (e.g. a checkbox). */
  leading?: ReactNode;
  /** Pulse the dot (genuinely live state only). */
  pulse?: boolean;
  /** The state in words (a11y: status is never colour alone) — first item of the muted line. */
  statusLabel: string;
  title: string;
  /** Rest of the muted secondary line (project · age …). */
  meta?: string;
  /** In-app route the title links to; omitted = plain text. */
  href?: string;
  /** Opens the Bridge sheet in the overlay's side slot on a plain click; `href` stays the fallback. */
  detail?: BridgeSelection;
  /** Accessible name of the title link (otherwise the title itself). */
  linkLabel?: string;
  /** Trailing action / meta (buttons, a count …). */
  trailing?: ReactNode;
  /** Settled rows (just decided) read dimmed. */
  dim?: boolean;
  /** Suffix for the row's test ids (a stable item key). */
  itemKey?: string;
  /** Overrides the status line's test id (a widget's own enum value, e.g. a settled state). */
  statusTestId?: string;
}

/**
 * One row of a chat widget: `status dot · title + muted secondary line · trailing`
 * (the `.ci2` grid of `zibby.css`). The title is the navigation target; trailing
 * actions are separate buttons — a link never wraps another interactive element.
 */
export function ChatWidgetRow({
  tone,
  leading,
  pulse = false,
  statusLabel,
  title,
  meta,
  href,
  detail,
  linkLabel,
  trailing,
  dim = false,
  itemKey,
  statusTestId,
}: ChatWidgetRowProps) {
  const suffix = itemKey ? `-${itemKey}` : "";
  const openDetail = useOpenDetail(detail);
  const titleText = (
    <Typography
      truncate
      as="span"
      size="sm"
      type="note"
      variant={dim ? "tertiary" : "primary"}
      weight="medium"
    >
      {title}
    </Typography>
  );
  return (
    <Container data-testid={`${ChatWidgetFrameTestId.Row}${suffix}`} padding={["100", "150"]}>
      <Stack align="center" direction="row" gap="150">
        {leading ?? (
          <span aria-hidden data-testid={`${ChatWidgetFrameTestId.RowDot}${suffix}`}>
            <StatusDot pulse={pulse} size="75" tone={tone} />
          </span>
        )}
        <Container grow minW0>
          <Stack direction="col" gap="25">
            {href ? (
              <TextLink
                truncate
                aria-label={linkLabel}
                data-testid={`${ChatWidgetFrameTestId.RowLink}${suffix}`}
                href={href as Route}
                linkComponent={NEXT_LINK}
                onClick={openDetail}
              >
                {titleText}
              </TextLink>
            ) : (
              titleText
            )}
            <Typography
              truncate
              data-testid={statusTestId ?? `${ChatWidgetFrameTestId.RowStatus}${suffix}`}
              size="xs"
              type="note"
              variant="tertiary"
            >
              {meta ? `${statusLabel} · ${meta}` : statusLabel}
            </Typography>
          </Stack>
        </Container>
        {trailing && (
          <Stack
            align="center"
            data-testid={`${ChatWidgetFrameTestId.RowTrailing}${suffix}`}
            direction="row"
            gap="75"
            shrink={false}
          >
            {trailing}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

/** Shared list math: the first `limit` items plus how many did not fit. */
export function takeRows<T>(items: readonly T[], limit: number | undefined, fallback = 5) {
  const max = limit ?? fallback;
  return { shown: items.slice(0, max), hiddenCount: Math.max(0, items.length - max) };
}

/** `loading` / `error` / `empty` / `ready` from a query-ish state. */
export function widgetStatus(q: {
  isPending: boolean;
  isError: boolean;
  count: number;
}): ChatWidgetStatus {
  if (q.isError) return "error";
  if (q.isPending) return "loading";
  return q.count === 0 ? "empty" : "ready";
}
