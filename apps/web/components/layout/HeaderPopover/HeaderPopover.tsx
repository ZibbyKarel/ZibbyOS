"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MenuSurface } from "@zibby/design-system";

export enum HeaderPopoverTestId {
  Panel = "header-popover-panel",
}

export interface HeaderPopoverTriggerProps {
  "aria-expanded": boolean;
  "aria-haspopup": "dialog";
  onClick: () => void;
}

export interface HeaderPopoverProps {
  /** The header control that toggles the panel; spread the given props on its button. */
  trigger: (props: HeaderPopoverTriggerProps) => ReactNode;
  /** Panel content (any widgets, unlike a menu's rows). */
  children: ReactNode;
  /** Panel width in px (clamped to the viewport). */
  width?: number;
  ariaLabel: string;
}

const GAP = 6;
const MARGIN = 8;

/**
 * A click popover for the header: portaled `fixed` under its trigger (the header row clips
 * overflow), right-aligned, closed by an outside press or Escape. App-local because the DS
 * `MenuSurface` is only the frame; this owns the open state and positioning.
 */
export function HeaderPopover({ trigger, children, width = 350, ariaLabel }: HeaderPopoverProps) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
  }, [open, updateRect]);

  const w = open ? Math.min(width, window.innerWidth - 2 * MARGIN) : width;
  return (
    <>
      <span ref={anchorRef}>
        {trigger({
          "aria-expanded": open,
          "aria-haspopup": "dialog",
          onClick: () => setOpen((o) => !o),
        })}
      </span>
      {open &&
        rect &&
        createPortal(
          <MenuSurface
            aria-label={ariaLabel}
            data-testid={HeaderPopoverTestId.Panel}
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
