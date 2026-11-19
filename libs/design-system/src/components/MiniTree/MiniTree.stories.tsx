import type { Meta, StoryObj } from "@storybook/react";
import { MiniTree } from "./MiniTree";

const meta: Meta<typeof MiniTree> = {
  title: "DesignSystem/MiniTree",
  component: MiniTree,
  args: {
    root: { label: "zibbycorp" },
    rows: [
      { id: "a", label: "Platforma" },
      { id: "b", label: "Růst" },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof MiniTree> = {};
