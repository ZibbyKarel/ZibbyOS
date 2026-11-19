"use client";
import { useCallback, useRef, useState } from "react";
import type { WorkflowGraph } from "../WorkflowDialog/workflow-graph";

const LIMIT = 100;
const COALESCE_MS = 800;

interface History {
  past: WorkflowGraph[];
  present: WorkflowGraph;
  future: WorkflowGraph[];
}

export type GraphUpdate = (g: WorkflowGraph) => WorkflowGraph;
/** `coalesce`: edits sharing a key within 800 ms collapse into one undo step (typing in a field). */
export type SetGraph = (update: GraphUpdate, coalesce?: string) => void;

/** Client-only undo/redo over the editor graph. */
export function useGraphHistory(initial: WorkflowGraph) {
  const [h, setH] = useState<History>({ past: [], present: initial, future: [] });
  const last = useRef<{ key: string; at: number } | null>(null);

  const set: SetGraph = useCallback((update, coalesce) => {
    const now = Date.now();
    const merge = Boolean(
      coalesce && last.current?.key === coalesce && now - last.current.at < COALESCE_MS,
    );
    last.current = coalesce ? { key: coalesce, at: now } : null;
    setH((cur) => {
      const next = update(cur.present);
      if (next === cur.present) return cur;
      return {
        past: merge ? cur.past : [...cur.past, cur.present].slice(-LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);
  const undo = useCallback(() => {
    last.current = null;
    setH((cur) => {
      const prev = cur.past[cur.past.length - 1];
      return prev
        ? { past: cur.past.slice(0, -1), present: prev, future: [cur.present, ...cur.future] }
        : cur;
    });
  }, []);
  const redo = useCallback(() => {
    last.current = null;
    setH((cur) => {
      const [next, ...rest] = cur.future;
      return next ? { past: [...cur.past, cur.present], present: next, future: rest } : cur;
    });
  }, []);
  const reset = useCallback((graph: WorkflowGraph) => {
    last.current = null;
    setH({ past: [], present: graph, future: [] });
  }, []);

  return {
    graph: h.present,
    set,
    undo,
    redo,
    reset,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  };
}
