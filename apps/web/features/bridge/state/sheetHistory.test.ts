import { act, fireEvent, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { BridgeSelection } from "../widgets/registry";
import { anchoredTo, selectionLabel, sheetHistory, useSheetHistory } from "./sheetHistory";

const row = (kind: BridgeSelection["kind"], id: string): BridgeSelection => ({
  kind,
  id,
  widgetId: `${kind}s`,
  key: `${kind}s:${id}`,
});
const issue = row("issue", "p1/ZB-1");
const pr = row("pr", "https://github.com/o/r/pull/12");
const run = row("run", "run_1");

describe("sheetHistory", () => {
  it("pushes, pops and clears", () => {
    const one = sheetHistory([], { type: "push", from: issue });
    const two = sheetHistory(one, { type: "push", from: pr });
    expect(two).toEqual([issue, pr]);
    expect(sheetHistory(two, { type: "pop" })).toEqual([issue]);
    expect(sheetHistory(two, { type: "clear" })).toEqual([]);
  });

  it("keeps the origin row's widget + key on an in-sheet open", () => {
    expect(anchoredTo(pr, issue)).toEqual({ ...pr, widgetId: "issues", key: issue.key });
  });

  it("labels a PR by number, an issue by key, others by id", () => {
    expect(selectionLabel(pr)).toBe("#12");
    expect(selectionLabel(issue)).toBe("ZB-1");
    expect(selectionLabel(run)).toBe("run_1");
  });
});

function useHarness() {
  const [sel, setSel] = useState<BridgeSelection | null>(issue);
  return { sel, setSel, ...useSheetHistory(sel, setSel) };
}

describe("useSheetHistory", () => {
  it("in-sheet opens stack up; back / Backspace / Alt+← pop one step", () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.open(pr));
    expect(result.current.sel).toMatchObject({ kind: "pr", key: issue.key });
    expect(result.current.prev).toBe(issue);
    act(() => result.current.open(run));
    expect(result.current.sel).toMatchObject({ kind: "run", key: issue.key });
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowLeft", altKey: true });
    });
    expect(result.current.sel?.kind).toBe("pr");
    act(() => {
      fireEvent.keyDown(window, { key: "Backspace" });
    });
    expect(result.current.sel).toBe(issue);
    expect(result.current.prev).toBeNull();
  });

  it("ignores Backspace while typing", () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.open(pr));
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => {
      fireEvent.keyDown(input, { key: "Backspace" });
    });
    expect(result.current.sel?.kind).toBe("pr");
    input.remove();
  });

  it("an outside selection change clears the stack", () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.open(pr));
    act(() => result.current.setSel(row("issue", "p1/ZB-2")));
    expect(result.current.prev).toBeNull();
  });
});
