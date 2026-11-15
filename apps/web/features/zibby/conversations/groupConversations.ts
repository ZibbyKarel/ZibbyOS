/** Which history bucket a conversation falls into. */
export type ConversationGroupId = "today" | "yesterday" | "thisWeek" | "older";

/** Localized bucket headings, supplied by the caller (this module is i18n-agnostic). */
export type ConversationGroupLabels = Record<ConversationGroupId, string>;

/** The one field grouping needs; any summary-like object qualifies. */
export interface GroupableConversation {
  /** ISO timestamp of the last message. */
  updatedAt: string;
}

/** One non-empty bucket, items in the order they came in (newest first). */
export interface ConversationGroup<T extends GroupableConversation> {
  id: ConversationGroupId;
  label: string;
  items: T[];
}

/** Local-midnight of the day `offsetDays` away from `now`. Built from calendar fields so DST shifts cannot skew it. */
function localDayStart(now: Date, offsetDays: number): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays).getTime();
}

/**
 * Where a timestamp falls, in the operator's LOCAL time:
 * today / yesterday / this week (the 5 calendar days before yesterday, i.e. the
 * last 7 days including today, so a weekday name is never ambiguous) / older.
 * Unparseable timestamps and anything older land in `older`; timestamps from the
 * future (clock skew) count as today.
 */
export function conversationGroupOf(updatedAt: string, now: Date): ConversationGroupId {
  const at = new Date(updatedAt).getTime();
  if (Number.isNaN(at)) return "older";
  if (at >= localDayStart(now, 0)) return "today";
  if (at >= localDayStart(now, -1)) return "yesterday";
  if (at >= localDayStart(now, -6)) return "thisWeek";
  return "older";
}

const GROUP_ORDER: readonly ConversationGroupId[] = ["today", "yesterday", "thisWeek", "older"];

/**
 * Bucket conversations into Today / Yesterday / This week / Older by `updatedAt`.
 * Keeps the incoming order inside each bucket and drops empty buckets.
 */
export function groupConversations<T extends GroupableConversation>(
  items: readonly T[],
  now: Date,
  labels: ConversationGroupLabels,
): ConversationGroup<T>[] {
  const buckets: Record<ConversationGroupId, T[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };
  for (const item of items) buckets[conversationGroupOf(item.updatedAt, now)].push(item);
  return GROUP_ORDER.filter((id) => buckets[id].length > 0).map((id) => ({
    id,
    label: labels[id],
    items: buckets[id],
  }));
}

/**
 * The short timestamp on a history row: "17:34" for today, the short weekday
 * within the last week (yesterday included), a short date otherwise (with the
 * year when it is not the current one). Unparseable input yields "".
 */
export function formatConversationTime(updatedAt: string, now: Date, locale: string): string {
  const at = new Date(updatedAt);
  if (Number.isNaN(at.getTime())) return "";
  const group = conversationGroupOf(updatedAt, now);
  if (group === "today") {
    return at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  }
  if (group === "yesterday" || group === "thisWeek") {
    return at.toLocaleDateString(locale, { weekday: "short" });
  }
  return at.toLocaleDateString(locale, {
    day: "numeric",
    month: "numeric",
    ...(at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}
