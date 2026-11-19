import type { Meta, StoryObj } from "@storybook/react";
import { CountGrid } from "./CountGrid";

const meta: Meta<typeof CountGrid> = {
  title: "DesignSystem/CountGrid",
  component: CountGrid,
  args: {
    items: [
      { id: "a", label: "Běží", value: 2, tone: "run" },
      { id: "b", label: "Čeká", value: 0, tone: "warn" },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof CountGrid> = {};
