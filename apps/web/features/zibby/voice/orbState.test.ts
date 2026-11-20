import { describe, expect, it } from "vitest";
import {
  DeriveOrbStateInput,
  ORB_STATE_LABEL_KEYS,
  classifyTool,
  deriveOrbState,
  orbStateLabelKey,
} from "./orbState";

const idle: DeriveOrbStateInput = {
  phase: "open",
  listening: false,
  thinking: false,
  lastToolEvent: null,
  streamingText: false,
  speaking: false,
  needsDecision: false,
  justDone: false,
  justErrored: false,
  paused: false,
  dragging: false,
};
const derive = (patch: Partial<DeriveOrbStateInput>) => deriveOrbState({ ...idle, ...patch });

describe("deriveOrbState", () => {
  it("listens when open and nothing happens", () => expect(derive({})).toBe("listen"));

  it("open: thinking thinks, streaming text speaks (voice off too), needs/done win, closed sleeps", () => {
    expect(derive({ thinking: true })).toBe("think");
    expect(derive({ thinking: true, streamingText: true })).toBe("speak");
    expect(derive({ needsDecision: true })).toBe("needs");
    expect(derive({ justDone: true })).toBe("done");
    expect(derive({ phase: "closed" })).toBe("sleep");
  });

  it("hands-free sequence: listen, think, speak, speak", () => {
    expect(derive({ listening: true })).toBe("listen");
    expect(derive({ thinking: true })).toBe("think");
    expect(derive({ streamingText: true })).toBe("speak");
    expect(derive({ speaking: true })).toBe("speak");
  });

  it("overlay phase wins over everything", () => {
    const loud = { listening: true, justErrored: true, speaking: true, paused: true };
    expect(derive({ phase: "closed", ...loud })).toBe("sleep");
    expect(derive({ phase: "summoning", ...loud })).toBe("wake");
    expect(derive({ phase: "leaving", ...loud })).toBe("wake");
  });

  // Each row beats every row below it.
  const ladder: [string, Partial<DeriveOrbStateInput>, string][] = [
    ["error", { justErrored: true }, "error"],
    ["listen", { listening: true }, "listen"],
    ["speak", { speaking: true }, "speak"],
    ["paused", { paused: true }, "paused"],
    ["in flight", { thinking: true, lastToolEvent: { name: "create_task" } }, "work"],
    ["needs", { needsDecision: true }, "needs"],
    ["done", { justDone: true }, "done"],
  ];
  it.each(ladder.map((_, i) => i))("rule %i beats all lower rules", (i) => {
    const row = ladder[i];
    if (!row) throw new Error("bad row");
    const lower = ladder.slice(i + 1).reduce((acc, r) => ({ ...acc, ...r[1] }), {});
    expect(derive({ ...lower, ...row[1] })).toBe(row[2]);
  });

  it("dragging acts like listening", () => expect(derive({ dragging: true })).toBe("listen"));

  it("classifies read tools as search and action tools as work", () => {
    for (const name of [
      "recall_memory",
      "get_status",
      "show_widget",
      "api_list_operations",
      "api_describe_operation",
      "slack_read_channel",
      "mcp__zibby__recall_memory",
    ])
      expect(derive({ thinking: true, lastToolEvent: { name } })).toBe("search");
    for (const name of ["create_task", "api_call", "open_folder", "mcp__zibby__create_task"])
      expect(derive({ thinking: true, lastToolEvent: { name } })).toBe("work");
    expect(classifyTool("something_unknown")).toBe("work");
  });

  it("thinks while in flight without a tool event", () =>
    expect(derive({ thinking: true })).toBe("think"));

  it("streaming text speaks and beats the tool event", () => {
    const base = { thinking: true, streamingText: true, lastToolEvent: { name: "api_call" } };
    expect(derive(base)).toBe("speak");
  });

  it("a turn in flight beats an older pending decision; listening beats paused", () => {
    expect(derive({ needsDecision: true, thinking: true })).toBe("think");
    expect(derive({ paused: true, listening: true })).toBe("listen");
    expect(derive({ paused: true, thinking: true })).toBe("paused");
    expect(derive({ needsDecision: true, justDone: true })).toBe("needs");
  });

  it("has a label key for each of the 12 states", () => {
    expect(Object.keys(ORB_STATE_LABEL_KEYS)).toHaveLength(12);
    expect(orbStateLabelKey("listen")).toBe("status.listen");
  });
});
