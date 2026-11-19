import { notFound, redirect } from "next/navigation";
import { SettingsScreen } from "../../../../../features/settings/Screen";
import {
  LEGACY_SETTINGS_REDIRECTS,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "../../../../../features/settings/settingsSections";

function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const legacy = LEGACY_SETTINGS_REDIRECTS[section];
  // `redirect` is typed against real routes; the targets are real settings sections.
  if (legacy) redirect(legacy as never);
  if (!isSettingsSection(section)) notFound();
  return <SettingsScreen section={section} />;
}
