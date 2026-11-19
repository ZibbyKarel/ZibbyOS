import type { Meta, StoryObj } from "@storybook/react";
import { StatCells } from "./StatCells";

const meta: Meta<typeof StatCells> = {
  title: "DesignSystem/StatCells",
  component: StatCells,
  args: {
    items: [
      { id: "a", label: "Podúkoly", value: 9, note: "1 na tebe" },
      { id: "b", label: "Agenti", value: 4 },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof StatCells> = {};
