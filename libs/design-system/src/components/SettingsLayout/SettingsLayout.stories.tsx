import type { Meta, StoryObj } from "@storybook/react";
import { SettingsPanel } from "../SettingsPanel/SettingsPanel";
import { SettingsRow } from "../SettingsRow/SettingsRow";
import { SettingsLayout } from "./SettingsLayout";

const meta: Meta<typeof SettingsLayout> = {
  title: "DesignSystem/SettingsLayout",
  component: SettingsLayout,
  parameters: { layout: "fullscreen" },
  args: {
    navTitle: "Settings",
    navLabel: "Settings pages",
    nav: [
      { id: "general", href: "#general", label: "General", icon: "gear", active: true },
      { id: "access", href: "#access", label: "Access & notifications", icon: "lock" },
      { id: "engines", href: "#engines", label: "AI engines", icon: "sparkles" },
      { id: "runtime", href: "#runtime", label: "Runtime", icon: "cog" },
      { id: "status", href: "#status", label: "Status & updates", icon: "pulse" },
    ],
    onNavigate: () => {},
    eyebrow: "Settings",
    title: "General",
    subtitle: "How do I want ZibbyOS to look and feel?",
    anchorsTitle: "On this page",
    anchors: [
      { id: "language", label: "Language" },
      { id: "appearance", label: "Appearance" },
      { id: "shortcuts", label: "Shortcuts", warn: true },
      { id: "live-log", label: "Live log", dirty: true },
    ],
    children: (
      <>
        <SettingsPanel id="language" title="Language">
          <SettingsRow label="Interface language" />
        </SettingsPanel>
        <SettingsPanel id="appearance" title="Appearance">
          <SettingsRow label="Theme" />
        </SettingsPanel>
      </>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof SettingsLayout>;

export const Default: Story = {};
