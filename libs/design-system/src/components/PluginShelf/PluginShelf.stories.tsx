import type { Meta, StoryObj } from "@storybook/react";
import { PluginShelf } from "./PluginShelf";

const meta: Meta<typeof PluginShelf> = {
  title: "DesignSystem/PluginShelf",
  component: PluginShelf,
  args: { total: 12, installed: 7 },
};
export default meta;
export const Default: StoryObj<typeof PluginShelf> = {};
