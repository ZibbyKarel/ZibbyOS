import type { Meta, StoryObj } from "@storybook/react";
import { Monogram } from "./Monogram";

const meta: Meta<typeof Monogram> = {
  title: "DesignSystem/Monogram",
  component: Monogram,
  args: { name: "Architekt", size: 48 },
};
export default meta;
export const Default: StoryObj<typeof Monogram> = {};
export const Round: StoryObj<typeof Monogram> = { args: { name: "Karel Zíbar", shape: "round" } };
