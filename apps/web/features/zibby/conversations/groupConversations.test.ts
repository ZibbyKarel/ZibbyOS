import { describe, expect, it } from "vitest";
import {
  conversationGroupOf,
  formatConversationTime,
  groupConversations,
} from "./groupConversations";

const labels = {
  today: "Dnes",
  yesterday: "Včera",
  thisWeek: "Tento týden",
  older: "Starší",
};

// Sunday 15 Nov 2026, 12:00 local. Every date is built from local calendar fields.
const now = new Date(2026, 10, 15, 12, 0, 0);
const at = (day: number, h = 12, m = 0, month = 10) =>
  new Date(2026, month, day, h, m, 0).toISOString();

describe("conversationGroupOf", () => {
  it("puts local midnight and later into today, one ms before into yesterday", () => {
    expect(conversationGroupOf(new Date(2026, 10, 15, 0, 0, 0, 0).toISOString(), now)).toBe(
      "today",
    );
    expect(conversationGroupOf(new Date(2026, 10, 14, 23, 59, 59, 999).toISOString(), now)).toBe(
      "yesterday",
    );
  });

  it("starts yesterday at its local midnight and this week right before it", () => {
    expect(conversationGroupOf(new Date(2026, 10, 14, 0, 0, 0, 0).toISOString(), now)).toBe(
      "yesterday",
    );
    expect(conversationGroupOf(new Date(2026, 10, 13, 23, 59, 59, 999).toISOString(), now)).toBe(
      "thisWeek",
    );
  });

  it("keeps 6 days back in this week and 7 days back in older", () => {
    expect(conversationGroupOf(new Date(2026, 10, 9, 0, 0, 0, 0).toISOString(), now)).toBe(
      "thisWeek",
    );
    expect(conversationGroupOf(new Date(2026, 10, 8, 23, 59, 59, 999).toISOString(), now)).toBe(
      "older",
    );
  });

  it("treats future timestamps as today and garbage as older", () => {
    expect(conversationGroupOf(at(16), now)).toBe("today");
    expect(conversationGroupOf("not-a-date", now)).toBe("older");
  });

  it("stays on calendar days across the autumn DST change (CET/CEST or any zone)", () => {
    // A "now" right after the last-Sunday-of-October shift: day arithmetic must use calendar days, not 24h blocks.
    const afterShift = new Date(2026, 9, 26, 0, 30, 0);
    expect(conversationGroupOf(new Date(2026, 9, 25, 23, 0, 0).toISOString(), afterShift)).toBe(
      "yesterday",
    );
    expect(conversationGroupOf(new Date(2026, 9, 20, 0, 0, 0).toISOString(), afterShift)).toBe(
      "thisWeek",
    );
    expect(conversationGroupOf(new Date(2026, 9, 19, 23, 59, 0).toISOString(), afterShift)).toBe(
      "older",
    );
  });
});

describe("groupConversations", () => {
  const item = (id: string, updatedAt: string) => ({ id, updatedAt });

  it("buckets, keeps newest-first order inside buckets and drops empty groups", () => {
    const groups = groupConversations(
      [
        item("a", at(15, 11)),
        item("b", at(15, 8)),
        item("c", at(14, 20)),
        item("d", at(11)),
        item("e", at(1)),
      ],
      now,
      labels,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Dnes", ["a", "b"]],
      ["Včera", ["c"]],
      ["Tento týden", ["d"]],
      ["Starší", ["e"]],
    ]);
  });

  it("omits groups without items", () => {
    const groups = groupConversations([item("a", at(15, 9)), item("z", at(1))], now, labels);
    expect(groups.map((g) => g.id)).toEqual(["today", "older"]);
    expect(groupConversations([], now, labels)).toEqual([]);
  });
});

describe("formatConversationTime", () => {
  it("shows HH:mm for today (24h, midnight as 00)", () => {
    expect(formatConversationTime(at(15, 9, 5), now, "cs")).toBe("09:05");
    expect(formatConversationTime(at(15, 17, 34), now, "cs")).toBe("17:34");
    expect(formatConversationTime(at(15, 0, 12), now, "en-US")).toBe("00:12");
  });

  it("shows the short weekday within the week, yesterday included", () => {
    expect(formatConversationTime(at(14), now, "en-US")).toBe("Sat");
    expect(formatConversationTime(at(11), now, "en-US")).toBe("Wed");
    expect(formatConversationTime(at(11), now, "cs")).toBe("st");
  });

  it("shows a short date otherwise, with the year only when it differs", () => {
    expect(formatConversationTime(at(1), now, "cs")).toBe("1. 11.");
    expect(formatConversationTime(new Date(2025, 11, 24, 10).toISOString(), now, "cs")).toBe(
      "24. 12. 2025",
    );
  });

  it("returns an empty string for an unparseable timestamp", () => {
    expect(formatConversationTime("nope", now, "cs")).toBe("");
  });
});
