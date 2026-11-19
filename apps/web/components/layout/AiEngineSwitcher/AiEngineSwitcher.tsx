"use client";

import {
  HeaderModeButton,
  Icon,
  type IconName,
  MenuButton,
  type MenuButtonEntry,
  type SubNavLinkComponent,
} from "@zibby/design-system";
import { MODEL_FAMILIES, type ModelFamily } from "@zibby/contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { modelFamilyChoice } from "../../../features/ai-providers";
import { useAiEnginesQuery } from "../../../features/ai-providers/queries";
import { useSetSystemConfigMutation } from "../../../features/system/mutations";
import { useSystemConfigQuery } from "../../../features/system/queries";

export enum AiEngineSwitcherTestId {
  Root = "ai-engine-switcher-root",
  SaveFailed = "ai-engine-switcher-save-failed",
}

export const FAMILY_ICON: Record<ModelFamily, IconName> = {
  claude: "claude",
  openai: "openai",
  opencode: "opencode",
  bluecode: "code",
};

/** Header family switch (a `HeaderModeButton`): the active family's glyph + name opens the other families (same write as Settings). */
export function AiEngineSwitcher({ compact = false }: { compact?: boolean } = {}): ReactNode {
  const t = useTranslations("aiEngine");
  const { data: config } = useSystemConfigQuery();
  const { data } = useAiEnginesQuery();
  const setConfig = useSetSystemConfigMutation();
  if (!config) return null;

  const { disconnected, choose } = modelFamilyChoice(config, data?.engines, setConfig.mutate);
  const items: MenuButtonEntry[] = [
    ...MODEL_FAMILIES.filter((f) => f !== config.modelFamily).map((f) => ({
      id: f,
      label: t(`family.${f}`),
      icon: FAMILY_ICON[f],
      disabled: disconnected.includes(f),
      description: disconnected.includes(f) ? t("switcherNotConnected") : undefined,
      onSelect: () => choose(f),
    })),
    { id: "divider", divider: true },
    {
      id: "settings",
      label: t("switcherSettings"),
      icon: "gear",
      href: "/system/settings/ai-engines",
    },
  ];

  const family = t(`family.${config.modelFamily}`);
  // A direct child of the header's `HeaderModeGroup` (its segments style by sibling position),
  // so the save-failed warning rides inside the trigger instead of beside it.
  return (
    <MenuButton
      items={items}
      linkComponent={Link as SubNavLinkComponent}
      renderTrigger={(props) => (
        <HeaderModeButton
          {...props}
          aria-label={t("switcher", { family })}
          data-testid={AiEngineSwitcherTestId.Root}
          icon={FAMILY_ICON[config.modelFamily]}
          label={compact ? undefined : family}
          trailing={
            <>
              {setConfig.isError && (
                <span
                  aria-label={t("saveFailed")}
                  data-testid={AiEngineSwitcherTestId.SaveFailed}
                  role="img"
                  title={t("saveFailed")}
                >
                  <Icon name="warn" size="sm" tone="warn" />
                </span>
              )}
              <Icon name="chevron" size="xs" />
            </>
          }
        />
      )}
    />
  );
}
