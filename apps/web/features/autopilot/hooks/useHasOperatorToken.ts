"use client";

import { useSyncExternalStore } from "react";
import { readOperatorToken, writeOperatorToken } from "../../../state/operatorToken";

const EVENT = "zibby:operator-token";

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
};

/** Persist the operator token and tell every `useHasOperatorToken` in this tab. */
export function saveOperatorToken(value: string) {
  writeOperatorToken(value);
  window.dispatchEvent(new Event(EVENT));
}

/** Whether this browser holds an operator token (the web cannot verify it; a 401 will). */
export function useHasOperatorToken(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readOperatorToken() !== "",
    () => false,
  );
}
