"use client";

import { Kbd, Stack } from "@zibby/design-system";
import { type ShortcutPlatform, type ZibbyShortcut, formatShortcut } from "./shortcut";
import { useShortcutPlatform, useZibbyShortcut } from "./useZibbyShortcut";

export enum ZibbyShortcutKbdTestId {
  Root = "zibby-shortcut-kbd-root",
}

export interface ZibbyShortcutKbdProps {
  /** Defaults to the operator's current shortcut. */
  shortcut?: ZibbyShortcut;
  /** Defaults to the detected platform. */
  platform?: ShortcutPlatform;
}

/** The summon shortcut as a row of `Kbd` keys (e.g. `⌥` `Space`). */
export function ZibbyShortcutKbd({ shortcut, platform }: ZibbyShortcutKbdProps) {
  const current = useZibbyShortcut().shortcut;
  const detected = useShortcutPlatform();
  const tokens = formatShortcut(shortcut ?? current, platform ?? detected);
  return (
    <Stack inline align="center" data-testid={ZibbyShortcutKbdTestId.Root} direction="row" gap="50">
      {tokens.map((token) => (
        <Kbd key={token}>{token}</Kbd>
      ))}
    </Stack>
  );
}
