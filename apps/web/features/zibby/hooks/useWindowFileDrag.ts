"use client";

import { useEffect, useRef } from "react";

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return types != null && Array.from(types).includes("Files");
}

/**
 * Window-level "a file is being dragged in" listener: while `enabled` (the overlay is closed),
 * the first `dragenter` carrying files calls `onFileDragEnter` so the host can open the overlay
 * with its drop zone showing. Once open, the overlay frame handles the drag/drop itself.
 * Drags that carry no files (text, links, in-page elements) are ignored.
 */
export function useWindowFileDrag(enabled: boolean, onFileDragEnter: () => void): void {
  const latest = useRef(onFileDragEnter);
  useEffect(() => {
    latest.current = onFileDragEnter;
  });

  useEffect(() => {
    if (!enabled) return;
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("dragenter", onDragEnter);
    return () => window.removeEventListener("dragenter", onDragEnter);
  }, [enabled]);
}
