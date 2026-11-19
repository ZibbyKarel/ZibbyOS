import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WorkflowGraph } from "../WorkflowDialog/workflow-graph";
import { useGraphHistory } from "./useGraphHistory";

const g = (n: number): WorkflowGraph => ({
  nodes: Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    type: "agent" as const,
    agent: "a",
    produces: "x.md",
    commands: "",
    model: "sonnet" as const,
    thinking: "medium" as const,
    x: 0,
    y: 0,
  })),
  flow: [],
  rework: [],
});

describe("useGraphHistory", () => {
  it("undoes and redoes, and a new edit clears redo", () => {
    const { result } = renderHook(() => useGraphHistory(g(0)));
    act(() => result.current.set(() => g(1)));
    act(() => result.current.set(() => g(2)));
    expect(result.current.graph.nodes).toHaveLength(2);
    act(() => result.current.undo());
    expect(result.current.graph.nodes).toHaveLength(1);
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.graph.nodes).toHaveLength(2);
    act(() => result.current.undo());
    act(() => result.current.set(() => g(5)));
    expect(result.current.canRedo).toBe(false);
  });

  it("coalesces same-key edits into one undo step and ignores no-op updates", () => {
    const { result } = renderHook(() => useGraphHistory(g(0)));
    act(() => result.current.set(() => g(1), "typing"));
    act(() => result.current.set(() => g(2), "typing"));
    act(() => result.current.undo());
    expect(result.current.graph.nodes).toHaveLength(0);
    act(() => result.current.set((x) => x));
    expect(result.current.canUndo).toBe(false);
  });
});
