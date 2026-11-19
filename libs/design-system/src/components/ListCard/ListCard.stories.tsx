import type { Meta, StoryObj } from "@storybook/react";
import { ListCard } from "./ListCard";

const meta: Meta<typeof ListCard> = {
  title: "DesignSystem/ListCard",
  component: ListCard,
  args: { children: "Card body" },
};
export default meta;
export const Default: StoryObj<typeof ListCard> = {};
