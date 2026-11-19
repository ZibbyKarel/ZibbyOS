import type { Meta, StoryObj } from "@storybook/react";
import { ListSection } from "./ListSection";

const meta: Meta<typeof ListSection> = {
  title: "DesignSystem/ListSection",
  component: ListSection,
  args: { title: "Produkty", count: 3, icon: "grid", children: <div className="h-12" /> },
};
export default meta;
export const Default: StoryObj<typeof ListSection> = {};
export const WithCode: StoryObj<typeof ListSection> = { args: { code: "ENG", icon: undefined } };
