import type { Meta, StoryObj } from "@storybook/react";
import { CodeTile } from "./CodeTile";

const meta: Meta<typeof CodeTile> = {
  title: "DesignSystem/CodeTile",
  component: CodeTile,
  args: { code: "ENG" },
};
export default meta;
export const Default: StoryObj<typeof CodeTile> = {};
