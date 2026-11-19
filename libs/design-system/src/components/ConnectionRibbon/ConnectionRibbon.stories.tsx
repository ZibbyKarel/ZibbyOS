import type { Meta, StoryObj } from "@storybook/react";
import { ConnectionRibbon } from "./ConnectionRibbon";

const meta: Meta<typeof ConnectionRibbon> = {
  title: "DesignSystem/ConnectionRibbon",
  component: ConnectionRibbon,
  args: {
    items: [
      { kind: "Company", label: "Acme Logistics", icon: "building", onSelect: () => undefined },
      { kind: "Team", label: "Platform", icon: "users", onSelect: () => undefined },
      { kind: "Project", label: "checkout-api", icon: "branch", current: true },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof ConnectionRibbon> = {};
