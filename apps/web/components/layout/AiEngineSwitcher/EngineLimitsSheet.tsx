"use client";

import { Container, MenuSurface, Stack, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import {
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { BudgetsWidget } from "../../../features/bridge/widgets/BudgetsWidget";

export enum EngineLimitsSheetTestId {
  Sheet = "engine-limits-sheet",
  Title = "engine-limits-sheet-title",
}

const WIDTH = 340;
const MARGIN = 8;
const noop = () => {};

export interface EngineLimitsTriggerProps {
  onMouseEnter: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave: (e: MouseEvent<HTMLElement>) => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
  onBlur: (e: FocusEvent<HTMLElement>) => void;
  /** Call from the trigger's own `onKeyDown`: Escape closes the sheet. */
  onEscape: (key: string) => void;
}

/**
 * The limits (bridge "Budgets & limits" widget) as a hover / keyboard-focus sheet under the AI
 * engine trigger. Render-prop: `children` renders the trigger with the handlers to spread; no
 * wrapper element is added (the header's mode group styles its buttons by sibling position).
 * Portaled to <body> and positioned `fixed` from the trigger's rect because the header row clips
 * overflow. While `menuOpen` (the trigger's click menu) the sheet never shows.
 */
export function EngineLimitsSheet({
  menuOpen,
  children,
}: {
  menuOpen: boolean;
  children: (props: EngineLimitsTriggerProps) => ReactNode;
}) {
  const t = useTranslations();
  const [hovered, setHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null);
  const open = hovered && !menuOpen;

  const updateRect = useCallback(() => {
    if (trigger) setRect(trigger.getBoundingClientRect());
  }, [trigger]);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, updateRect]);

  const show = (e: { currentTarget: HTMLElement }) => {
    setTrigger(e.currentTarget);
    setRect(e.currentTarget.getBoundingClientRect());
    setHovered(true);
  };
  // The sheet is portaled, so moving the pointer / focus onto it must not count as leaving.
  const inSheet = (next: EventTarget | null) =>
    next instanceof Node && sheetEl?.contains(next) === true;
  const width = () => Math.min(WIDTH, window.innerWidth - 2 * MARGIN);
  const title = t("bridge.widget.budgets.label");

  return (
    <>
      {children({
        onMouseEnter: show,
        onMouseLeave: (e) => !inSheet(e.relatedTarget) && setHovered(false),
        onFocus: show,
        onBlur: (e) => !inSheet(e.relatedTarget) && setHovered(false),
        onEscape: (key) => key === "Escape" && setHovered(false),
      })}
      {open &&
        rect &&
        createPortal(
          <MenuSurface
            data-testid={EngineLimitsSheetTestId.Sheet}
            onMouseLeave={(e) => e.relatedTarget !== trigger && setHovered(false)}
            placement="fixed"
            ref={setSheetEl}
            style={{
              top: rect.bottom,
              left: Math.max(
                MARGIN,
                Math.min(rect.right - width(), window.innerWidth - width() - MARGIN),
              ),
              width: width(),
              zIndex: 60,
            }}
          >
            <Container padding="200">
              <Stack gap="150">
                <Typography data-testid={EngineLimitsSheetTestId.Title} type="label">
                  {title}
                </Typography>
                <BudgetsWidget onEmptyChange={noop} />
              </Stack>
            </Container>
          </MenuSurface>,
          document.body,
        )}
    </>
  );
}
