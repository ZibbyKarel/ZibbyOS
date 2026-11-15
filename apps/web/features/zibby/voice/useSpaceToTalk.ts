"use client";

import { useEffect, useRef } from "react";

export interface UseSpaceToTalkOptions {
  /** Listeners are attached only while `true`; turning it off mid-hold fires `onUp`. */
  enabled: boolean;
  /** Space went down (first, non-repeat keydown). `preventDefault()` was already called. */
  onDown: () => void;
  /** The hold ended: keyup, window blur, or `enabled` turning false / unmounting mid-hold. */
  onUp: () => void;
}

/**
 * Elements where Space keeps its native meaning: text entry (a space character) and
 * controls that activate on Space. Matched on the target and its ancestors.
 * Opt a control back in with `data-ptt-allow` on it (or an ancestor between it and the
 * control) — e.g. the overlay's own push-to-talk button, which keeps focus after a click.
 */
const NATIVE_SPACE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[role="slider"]',
  '[role="link"]',
].join(",");

/** `true` when Space on this event target must keep its normal meaning. */
export function spaceBelongsToTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest(NATIVE_SPACE_SELECTOR);
  if (!control) return false;
  if (control.closest("[data-ptt-allow]")) return false;
  return true;
}

function isBareSpace(event: KeyboardEvent): boolean {
  return (
    (event.code === "Space" || event.key === " ") &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.isComposing
  );
}

/**
 * The in-overlay push-to-talk key: bare Space (no modifiers) on `window`. Ignored when the
 * event target is an editable element or a control that natively activates on Space
 * ("když je v poli fokus, mezerník píše mezeru"). Auto-repeat is swallowed; `preventDefault`
 * stops the page scrolling. Handlers go through refs, so listeners attach once per `enabled`.
 */
export function useSpaceToTalk({ enabled, onDown, onUp }: UseSpaceToTalkOptions): void {
  const onDownRef = useRef(onDown);
  const onUpRef = useRef(onUp);
  useEffect(() => {
    onDownRef.current = onDown;
    onUpRef.current = onUp;
  });

  useEffect(() => {
    if (!enabled) return;
    let held = false;

    const release = () => {
      if (!held) return;
      held = false;
      onUpRef.current();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isBareSpace(event)) return;
      if (held) {
        // our own hold: keep the page from scrolling / the focused control from clicking
        event.preventDefault();
        return;
      }
      if (spaceBelongsToTarget(event.target)) return;
      event.preventDefault();
      if (event.repeat) return;
      held = true;
      onDownRef.current();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      if (!held) return;
      event.preventDefault();
      release();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", release);
      release();
    };
  }, [enabled]);
}
