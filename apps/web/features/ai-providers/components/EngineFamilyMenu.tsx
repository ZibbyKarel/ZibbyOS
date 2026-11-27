"use client";

import { Icon, type IconName, Stack, Typography, ZibbyStatusLink } from "@zibby/design-system";
import { MODEL_FAMILIES, type ModelFamily } from "@zibby/contracts";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSetSystemConfigMutation } from "../../system/mutations";
import { useSystemConfigQuery } from "../../system/queries";
import { modelFamilyChoice } from "../modelFamilyChoice";
import { useAiEnginesQuery } from "../queries";

export enum EngineFamilyMenuTestId {
  Toggle = "engine-family-menu-toggle",
  Family = "engine-family-menu-family",
  Settings = "engine-family-menu-settings",
  SaveFailed = "engine-family-menu-save-failed",
}

export const AI_ENGINES_SETTINGS_HREF = "/system/settings/ai-engines";

const FAMILY_ICON: Record<ModelFamily, IconName> = {
  claude: "claude",
  openai: "openai",
  opencode: "opencode",
  bluecode: "code",
};

export interface EngineFamilyMenuProps {
  /** Called after the settings link is followed, so the popover/sheet can close. */
  onNavigate: () => void;
}

/** "AI engine" entry of the Zibby status menu: expands to the model families, then "Settings". */
export function EngineFamilyMenu({ onNavigate }: EngineFamilyMenuProps) {
  const t = useTranslations("aiEngine");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: config } = useSystemConfigQuery();
  const { data } = useAiEnginesQuery();
  const setConfig = useSetSystemConfigMutation();
  if (!config) return null;

  const { disconnected, choose } = modelFamilyChoice(config, data?.engines, setConfig.mutate);
  return (
    <Stack gap="25">
      <ZibbyStatusLink
        aria-expanded={open}
        data-testid={EngineFamilyMenuTestId.Toggle}
        hint={t(`family.${config.modelFamily}`)}
        icon={FAMILY_ICON[config.modelFamily]}
        label={t("title")}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <>
          {MODEL_FAMILIES.map((f) => (
            <ZibbyStatusLink
              aria-current={f === config.modelFamily ? "true" : undefined}
              data-testid={`${EngineFamilyMenuTestId.Family}-${f}`}
              disabled={disconnected.includes(f)}
              hint={
                disconnected.includes(f)
                  ? t("switcherNotConnected")
                  : f === config.modelFamily
                    ? t("switcherCurrent")
                    : undefined
              }
              icon={f === config.modelFamily ? <Icon name="check" size="md" /> : FAMILY_ICON[f]}
              key={f}
              label={t(`family.${f}`)}
              onClick={() => choose(f)}
            />
          ))}
          <ZibbyStatusLink
            data-testid={EngineFamilyMenuTestId.Settings}
            icon="gear"
            label={t("switcherSettings")}
            onClick={() => {
              router.push(AI_ENGINES_SETTINGS_HREF as Route);
              onNavigate();
            }}
          />
          {setConfig.isError && (
            <Typography
              data-testid={EngineFamilyMenuTestId.SaveFailed}
              size="xs"
              tone="bad"
              type="note"
            >
              {t("saveFailed")}
            </Typography>
          )}
        </>
      )}
    </Stack>
  );
}
