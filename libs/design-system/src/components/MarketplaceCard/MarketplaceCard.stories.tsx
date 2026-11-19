import type { Meta, StoryObj } from "@storybook/react";
import { MarketplaceCard } from "./MarketplaceCard";

const meta: Meta<typeof MarketplaceCard> = {
  title: "DesignSystem/MarketplaceCard",
  component: MarketplaceCard,
  args: {
    name: "zibby-dev",
    kind: "dev",
    kindLabel: "dev",
    source: "github.com/zibby/plugins",
    installed: 7,
    total: 12,
    installedText: ["Nainstalováno ", " z 12 pluginů"],
  },
};
export default meta;
export const Default: StoryObj<typeof MarketplaceCard> = {};
