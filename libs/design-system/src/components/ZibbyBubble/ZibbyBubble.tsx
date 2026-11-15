"use client";
import type { KeyboardEvent, MouseEvent, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum ZibbyBubbleTestId {
  Root = "zibby-bubble-root",
  Avatar = "zibby-bubble-avatar",
  Content = "zibby-bubble-content",
  Caret = "zibby-bubble-caret",
  Attachments = "zibby-bubble-attachments",
  Meta = "zibby-bubble-meta",
  Cards = "zibby-bubble-cards",
  Actions = "zibby-bubble-actions",
}

export type ZibbyBubbleAuthor = "me" | "zibby";

export interface ZibbyBubbleProps {
  /** Who spoke. `me` = right-aligned bubble, `zibby` = left avatar + free text. */
  author: ZibbyBubbleAuthor;
  /** The message body (plain text for `me`; rendered markdown / text for `zibby`). */
  children?: ReactNode;
  /** `me` only: attachment chips rendered inside the bubble under the text (right-aligned). */
  attachments?: ReactNode;
  /** `me` only: small line under the text, e.g. mic icon + "přepis · 17:33". */
  meta?: ReactNode;
  /** `me` only: makes the whole bubble a button ("click to correct and resend"). */
  onEdit?: () => void;
  /** Accessible name of the edit button. Default `"Edit and resend"`. */
  editLabel?: string;
  /** `zibby` only: 28 px avatar slot (pass a 28 px `ZibbyOrb`). */
  avatar?: ReactNode;
  /** `zibby` only: show the blinking amber caret after the content. */
  streaming?: boolean;
  /** `zibby` only: inline widgets / cards rendered under the text, 10 px apart. */
  cards?: ReactNode;
  /** `zibby` only: quiet action row (speak aloud, create task…), revealed on hover / focus-within, always on touch. */
  actions?: ReactNode;
  "data-testid"?: string;
  ref?: Ref<HTMLDivElement>;
}

const wrapText = "min-w-0 [overflow-wrap:anywhere] select-text";

/**
 * One message of the Zibby thread (`.zm.me` / `.zm.z` of `design/zibby/zibby.css`).
 * Selectable text, long words / code wrap instead of overflowing.
 */
export function ZibbyBubble({
  author,
  children,
  attachments,
  meta,
  onEdit,
  editLabel = "Edit and resend",
  avatar,
  streaming = false,
  cards,
  actions,
  "data-testid": testId = ZibbyBubbleTestId.Root,
  ref,
}: ZibbyBubbleProps) {
  if (author === "me") {
    const onClick = onEdit
      ? (e: MouseEvent<HTMLDivElement>) => {
          // Selecting text inside the bubble must not count as "edit".
          if (e.defaultPrevented || window.getSelection()?.toString()) return;
          onEdit();
        }
      : undefined;
    const onKeyDown = onEdit
      ? (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit();
          }
        }
      : undefined;
    return (
      <div
        aria-label={onEdit ? editLabel : undefined}
        className={cn(
          "zibby-me-bubble self-end max-w-[74%] px-[14px] py-[10px] rounded-[16px_16px_4px_16px]",
          "bg-panel-2 border border-line-2 text-ink text-[15px] leading-[1.45]",
          "whitespace-pre-wrap",
          wrapText,
          onEdit && `cursor-pointer hover:border-ink-3 ${focusRing}`,
        )}
        data-author="me"
        data-testid={testId}
        onClick={onClick}
        onKeyDown={onKeyDown}
        ref={ref}
        role={onEdit ? "button" : undefined}
        tabIndex={onEdit ? 0 : undefined}
      >
        {children}
        {attachments ? (
          <div
            className="mt-[6px] flex flex-wrap justify-end gap-[6px] whitespace-normal"
            data-testid={ZibbyBubbleTestId.Attachments}
          >
            {attachments}
          </div>
        ) : null}
        {meta ? (
          <div
            className="mt-1 flex items-center justify-end gap-[5px] text-[11px] text-ink-3 whitespace-normal"
            data-testid={ZibbyBubbleTestId.Meta}
          >
            {meta}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      aria-busy={streaming || undefined}
      className={cn(
        "group/zm self-start grid grid-cols-[28px_minmax(0,1fr)] gap-3 max-w-[90%]",
        cards ? "w-[90%]" : undefined,
      )}
      data-author="zibby"
      data-testid={testId}
      ref={ref}
    >
      <div className="h-7 w-7" data-testid={ZibbyBubbleTestId.Avatar}>
        {avatar}
      </div>
      <div className="min-w-0">
        <div
          className={cn("pt-[3px] text-[16px] leading-[1.55] text-ink text-pretty", wrapText)}
          data-testid={ZibbyBubbleTestId.Content}
        >
          {children}
          {streaming ? (
            <span
              aria-hidden="true"
              className="ml-[3px] inline-block h-[17px] w-0.5 bg-accent align-[-3px] animate-[zb-caret_1s_step-end_infinite]"
              data-testid={ZibbyBubbleTestId.Caret}
            />
          ) : null}
        </div>
        {cards ? (
          <div className="mt-[10px] flex flex-col gap-[10px]" data-testid={ZibbyBubbleTestId.Cards}>
            {cards}
          </div>
        ) : null}
        {actions ? (
          <div
            className={cn(
              "mt-1.5 flex flex-wrap items-center gap-1 transition-opacity",
              "opacity-0 group-hover/zm:opacity-100 group-focus-within/zm:opacity-100",
              "[@media(hover:none)]:opacity-100",
            )}
            data-testid={ZibbyBubbleTestId.Actions}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
