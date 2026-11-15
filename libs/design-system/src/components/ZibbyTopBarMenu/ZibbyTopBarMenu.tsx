"use client";
import { type KeyboardEvent, type Ref, useEffect, useId, useRef, useState } from "react";
import { useDismissOnOutside } from "../../hooks/useDismissOnOutside";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";
import { ZibbyIconButton } from "../ZibbyIconButton/ZibbyIconButton";

export enum ZibbyTopBarMenuTestId {
  Root = "zibby-top-bar-menu-root",
  Trigger = "zibby-top-bar-menu-trigger",
  Menu = "zibby-top-bar-menu-menu",
  /** Suffixed with the item `id` (or its index when no id is given). */
  Item = "zibby-top-bar-menu-item",
}

export interface ZibbyTopBarMenuItem {
  /** Stable key / test-id suffix; falls back to the item's index. */
  id?: string;
  label: string;
  icon?: IconName;
  onSelect: () => void;
  disabled?: boolean;
  /** Paints the row with the `bad` token (a destructive action). */
  danger?: boolean;
}

export interface ZibbyTopBarMenuProps {
  items: ZibbyTopBarMenuItem[];
  /** Accessible name of the `⋯` trigger. */
  label?: string;
  /** Glyph of the trigger. */
  icon?: IconName;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The `⋯` menu of the overlay top bar (`.zmw` + `.zmenu`): an icon trigger and a 230 px popover
 * of action rows. Focus moves into the menu on open (roving, Arrow/Home/End), Escape closes it
 * and stops propagating so the overlay itself stays open, outside press and Tab close it.
 */
export function ZibbyTopBarMenu({
  items,
  label = "More actions",
  icon = "dots",
  ref,
}: ZibbyTopBarMenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  useDismissOnOutside({ open, refs: [wrapRef], onDismiss: () => setOpen(false) });

  const enabled = items.flatMap((it, i) => (it.disabled ? [] : [i]));

  const openMenu = () => {
    setActive(enabled[0] ?? 0);
    setOpen(true);
  };

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
    // Focus only when the menu opens or the roving index moves.
  }, [open, active]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const move = (delta: 1 | -1 | "first" | "last") => {
    if (enabled.length === 0) return;
    const pos = enabled.indexOf(active);
    const next =
      delta === "first"
        ? 0
        : delta === "last"
          ? enabled.length - 1
          : (pos + delta + enabled.length) % enabled.length;
    setActive(enabled[next] ?? active);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (open && e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (open && e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (open && e.key === "Home") {
      e.preventDefault();
      move("first");
    } else if (open && e.key === "End") {
      e.preventDefault();
      move("last");
    } else if (open && e.key === "Tab") {
      close(false);
    } else if (!open && e.key === "ArrowDown" && e.target === triggerRef.current) {
      e.preventDefault();
      openMenu();
    }
  };

  const select = (item: ZibbyTopBarMenuItem) => {
    if (item.disabled) return;
    // Focus returns to the trigger first so an item that moves focus (rename) wins afterwards.
    close(true);
    item.onSelect();
  };

  return (
    <div
      className="relative"
      data-testid={ZibbyTopBarMenuTestId.Root}
      onKeyDown={onKeyDown}
      ref={(node) => {
        wrapRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
    >
      <ZibbyIconButton
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid={ZibbyTopBarMenuTestId.Trigger}
        icon={icon}
        label={label}
        onClick={() => (open ? close(false) : openMenu())}
        ref={triggerRef}
      />
      {open && (
        <div
          aria-label={label}
          className={cn(
            "absolute right-0 top-[34px] z-10 flex w-[230px] flex-col rounded-xl border border-line-2",
            "bg-panel p-[5px] text-ink shadow-[var(--shadow-pop)]",
          )}
          data-testid={ZibbyTopBarMenuTestId.Menu}
          id={menuId}
          role="menu"
        >
          {items.map((item, i) => (
            <button
              className={cn(
                "flex cursor-pointer items-center gap-[9px] rounded-lg border-none bg-transparent px-[10px] py-2",
                "text-left font-sans text-[13px] transition-colors duration-100 motion-reduce:transition-none",
                item.danger ? "text-bad" : "text-ink",
                "enabled:hover:bg-panel-2 disabled:cursor-default disabled:opacity-40",
                focusRingInset,
              )}
              data-testid={`${ZibbyTopBarMenuTestId.Item}-${item.id ?? i}`}
              disabled={item.disabled}
              key={item.id ?? i}
              onClick={() => select(item)}
              ref={(node) => {
                itemRefs.current[i] = node;
              }}
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              type="button"
            >
              {item.icon && <Icon name={item.icon} size="sm" />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
