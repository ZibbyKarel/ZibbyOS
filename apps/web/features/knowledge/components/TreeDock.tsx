"use client";

import type { ReactNode } from "react";
import {
  Button,
  Container,
  Divider,
  Icon,
  Pressable,
  Stack,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";

export enum TreeDockTestId {
  Root = "brain-tree-dock",
  Rail = "brain-tree-rail",
  Close = "brain-tree-close",
}

export interface TreeDockProps {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

const RAIL_W = 44;
const PANEL_W = 252;

/**
 * The tree is the text twin of the graph and starts folded into a thin vertical "Strom" rail
 * between the graph and the reader; a click on the rail opens it as a 252px column.
 */
export function TreeDock({ open, onToggle, children }: TreeDockProps) {
  const t = useTranslations("knowledge.brain.tree");
  if (!open)
    return (
      <Container data-testid={TreeDockTestId.Root} shrink={false} width={`${RAIL_W}px`}>
        <Pressable aria-label={t("openTree")} data-testid={TreeDockTestId.Rail} onClick={onToggle}>
          <Container padding={["150", "0"]} textAlign="center">
            <Stack align="center" gap="100">
              <Icon name="layout" size="sm" tone="faint" />
              <svg aria-hidden="true" height={52} viewBox="0 0 16 52" width={16}>
                <text
                  fill="var(--color-ink-2)"
                  fontSize={12}
                  textAnchor="middle"
                  transform="translate(12 26) rotate(-90)"
                >
                  {t("rail")}
                </text>
              </svg>
            </Stack>
          </Container>
        </Pressable>
      </Container>
    );
  return (
    <Container
      data-testid={TreeDockTestId.Root}
      overflowY="auto"
      shrink={false}
      width={`${PANEL_W}px`}
    >
      <Stack>
        <Container padding={["100", "100", "100", "175"]}>
          <Stack align="center" direction="row" justify="between">
            <Typography mono uppercase size="2xs" type="note" variant="tertiary">
              {t("rail")}
            </Typography>
            <Button
              aria-label={t("closeTree")}
              data-testid={TreeDockTestId.Close}
              icon="collapse"
              intent="ghost"
              onClick={onToggle}
              size="sm"
            />
          </Stack>
        </Container>
        <Divider />
        <Container padding="75">{children}</Container>
      </Stack>
    </Container>
  );
}
