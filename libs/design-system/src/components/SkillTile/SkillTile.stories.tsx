import type { Meta, StoryObj } from "@storybook/react";
import { SkillTile } from "./SkillTile";

const meta: Meta<typeof SkillTile> = {
  title: "DesignSystem/SkillTile",
  component: SkillTile,
  args: {
    name: "pdf",
    source: "anthropic",
    description: "Čtení, tvorba a slučování PDF",
    footer: "Napojeno na FIN",
  },
};
export default meta;
export const Default: StoryObj<typeof SkillTile> = {};
