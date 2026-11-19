import type { Meta, StoryObj } from "@storybook/react";
import { ListEmptyRow } from "./ListEmptyRow";

const meta: Meta<typeof ListEmptyRow> = {
  title: "DesignSystem/ListEmptyRow",
  component: ListEmptyRow,
  args: { text: "Prázdná kategorie" },
};
export default meta;
export const Default: StoryObj<typeof ListEmptyRow> = {};
