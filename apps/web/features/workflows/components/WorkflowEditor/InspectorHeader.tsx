"use client";
import {
  Button,
  Container,
  type IconName,
  IconTile,
  MenuButton,
  type MenuButtonEntry,
  Stack,
  Typography,
} from "@zibby/design-system";
import type { ReactNode } from "react";

export enum InspectorHeaderTestId {
  Root = "wd-inspector-header",
  Title = "wd-inspector-title",
  Subtitle = "wd-inspector-subtitle",
  Close = "wd-inspector-close",
}

export interface InspectorHeaderProps {
  /** The leading face: a phase avatar; omitted → a glyph tile (workflow settings). */
  lead?: ReactNode;
  glyph?: IconName;
  title: string;
  subtitle: string;
  /** `⋯` menu rows; omitted → no menu. */
  menu?: MenuButtonEntry[];
  menuLabel: string;
  closeLabel: string;
  onClose: () => void;
}

/** Inspector head: face · title / subtitle · ⋯ · ✕ — the same bar for a phase and for the workflow. */
export function InspectorHeader(p: InspectorHeaderProps) {
  return (
    <Container
      data-testid={InspectorHeaderTestId.Root}
      shrink={false}
      style={{ padding: "12px 10px 12px 14px", borderBottom: "1px solid var(--color-border)" }}
    >
      <Stack align="center" direction="row" gap="125">
        {p.lead ?? <IconTile glyph={p.glyph ?? "gear"} size="lg" />}
        <Container grow minW0>
          <Typography
            truncate
            data-testid={InspectorHeaderTestId.Title}
            size="md"
            type="note"
            weight="semibold"
          >
            {p.title}
          </Typography>
          <Typography
            truncate
            data-testid={InspectorHeaderTestId.Subtitle}
            size="xs"
            type="note"
            variant="tertiary"
          >
            {p.subtitle}
          </Typography>
        </Container>
        {p.menu && <MenuButton ariaLabel={p.menuLabel} items={p.menu} />}
        <Button
          aria-label={p.closeLabel}
          data-testid={InspectorHeaderTestId.Close}
          icon="x"
          intent="ghost"
          onClick={p.onClose}
          size="sm"
        />
      </Stack>
    </Container>
  );
}
