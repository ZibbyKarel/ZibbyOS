"use client";

import { MenuSurface } from "@zibby/design-system";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export enum ModePopoverTestId {
  Panel = "mode-popover-panel",
}

export interface ModePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The header control that toggles the panel; spread the given props on its button. */
  trigger: (props: {
    "aria-expanded": boolean;
    "aria-haspopup": "dialog";
    onClick: () => void;
  }) => ReactNode;
  children: ReactNode;
  ariaLabel: string;
  width?: number;
}

const GAP = 10;
const MARGIN = 8;

/**
 * A controlled click popover under its trigger (portaled `fixed`, right-aligned, closed by an
 * outside press or Escape). Same behaviour as the app's `HeaderPopover`, which cannot be closed
 * from inside; here picking a mode closes it.
 */
export function ModePopover({
  open,
  onOpenChange,
  trigger,
  children,
  ariaLabel,
  width = 400,
}: ModePopoverProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const updateRect = useCallback(() => {
    if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!open) return;
    updateRect();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, onOpenChange, updateRect]);

  const w = open ? Math.min(width, window.innerWidth - 2 * MARGIN) : width;
  return (
    <>
      <span ref={anchorRef}>
        {trigger({
          "aria-expanded": open,
          "aria-haspopup": "dialog",
          onClick: () => onOpenChange(!open),
        })}
      </span>
      {open &&
        rect &&
        createPortal(
          <MenuSurface
            aria-label={ariaLabel}
            data-testid={ModePopoverTestId.Panel}
            placement="fixed"
            ref={panelRef}
            role="dialog"
            style={{
              top: rect.bottom + GAP,
              left: Math.max(MARGIN, Math.min(rect.right - w, window.innerWidth - w - MARGIN)),
              width: w,
              zIndex: 60,
            }}
          >
            {children}
          </MenuSurface>,
          document.body,
        )}
    </>
  );
}
