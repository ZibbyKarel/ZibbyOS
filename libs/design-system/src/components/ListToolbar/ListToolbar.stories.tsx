import type { Meta, StoryObj } from "@storybook/react";
import { ListToolbar } from "./ListToolbar";

const meta: Meta<typeof ListToolbar> = {
  title: "DesignSystem/ListToolbar",
  component: ListToolbar,
  args: {
    search: { value: "", onChange: () => undefined, placeholder: "Hledat projekt" },
    chips: [
      { id: "all", label: "Vše", count: 7 },
      { id: "run", label: "Běží", count: 3 },
      { id: "wait", label: "Čeká na tebe", count: 2 },
    ],
    activeChip: "all",
  },
};
export default meta;
export const Default: StoryObj<typeof ListToolbar> = {};
