"use client";

import {
  Button,
  CommandBarGroup,
  Container,
  DENSITIES,
  MenuButton,
  SegmentedControl,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { PageActions } from "../../../components/layout/PageActions";
import { useUiSettings } from "../../system";
import { CUSTOM_PRESET } from "../state/useBridgeState";

export enum BridgeHeaderTestId {
  Manage = "bridge-header-manage",
}

export interface BridgeHeaderProps {
  preset: string;
  /** Layouts shown in the header; hidden ones are only reachable from the manage dialog. */
  layouts: { shown: readonly string[]; hidden: readonly string[] };
  onPreset: (name: string) => void;
  onManage: () => void;
  /** Phone toolbar: only the manage-layouts button. */
  compact?: boolean;
}

/** The Bridge page controls (no title row — the sub-nav names the page) — layout
 *  presets (segmented), density (system-wide) and the manage-layouts button — portalled into the shell's sub-menu row before "+ NEW TASK". */
export function BridgeHeader({
  preset,
  layouts,
  onPreset,
  onManage,
  compact = false,
}: BridgeHeaderProps) {
  const t = useTranslations("bridge");
  const { ui, setDensity } = useUiSettings();

  const presetLabel = (name: string) =>
    name === "DEFAULT"
      ? t("preset.DEFAULT")
      : name === "REVIEW"
        ? t("preset.REVIEW")
        : name === CUSTOM_PRESET
          ? t("preset.CUSTOM")
          : name;
  const names = [
    ...layouts.shown,
    ...(layouts.hidden.includes(preset) ? [preset] : []),
    ...(preset === CUSTOM_PRESET ? [CUSTOM_PRESET] : []),
  ];

  if (compact) {
    return (
      <PageActions>
        <Container data-testid={BridgeHeaderTestId.Manage}>
          <Button
            aria-label={t("editLayout")}
            icon="layout"
            intent="ghost"
            onClick={onManage}
            size="sm"
            title={t("editLayout")}
          />
        </Container>
      </PageActions>
    );
  }

  return (
    <PageActions>
      <CommandBarGroup>
        <SegmentedControl
          ariaLabel={t("layout")}
          items={names.map((name) => ({ value: name, label: presetLabel(name) }))}
          onChange={(name) => name !== CUSTOM_PRESET && onPreset(name)}
          size="sm"
          value={preset}
        />
      </CommandBarGroup>
      <MenuButton
        ariaLabel={t("viewOptions")}
        icon="layout"
        items={[
          { id: "density", heading: t("density.label") },
          ...DENSITIES.map((d) => ({
            id: `density-${d}`,
            label: t(`density.${d}`),
            indent: true,
            trailing: d === ui.density ? "✓" : undefined,
            onSelect: () => setDensity(d),
          })),
          { id: "sep", divider: true as const },
          { id: "layouts", label: t("layoutSettings"), icon: "layout", onSelect: onManage },
        ]}
      />
    </PageActions>
  );
}
