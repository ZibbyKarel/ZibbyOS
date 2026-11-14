import type { Meta, StoryObj } from "@storybook/react";
import { BriefingHero } from "./BriefingHero";

const counters = [
  { id: "needs", label: "Na tebe", value: "03", tone: "accent" as const, href: "#" },
  { id: "running", label: "Běží", value: "00", tone: "dim" as const, href: "#" },
  { id: "prs", label: "Otevřené PR", value: "37", href: "#" },
  { id: "review", label: "K review", value: "29", href: "#" },
  { id: "failing", label: "Selhává", value: "01", tone: "error" as const },
];

const meta: Meta<typeof BriefingHero> = {
  title: "DesignSystem/BriefingHero",
  component: BriefingHero,
  args: {
    ariaLabel: "Briefing",
    eyebrow: "Sobota 14. listopadu · 20:50",
    title: "Dobrý večer.",
    lead: "Tři věci čekají na tebe. Jinak klid: nic neběží.",
    counters,
  },
};
export default meta;

type Story = StoryObj<typeof BriefingHero>;

export const Full: Story = {};
export const Empty: Story = { args: { title: "Klidný den.", lead: undefined, eyebrow: undefined } };
export const Slim: Story = {
  args: {
    variant: "slim",
    title: "29 PR čeká na review, 2 přímo na tebe.",
    counters: counters.slice(0, 4),
  },
};
export const Phone: Story = {
  args: { variant: "phone" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
