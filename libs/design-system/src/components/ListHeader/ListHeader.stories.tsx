import type { Meta, StoryObj } from "@storybook/react";
import { ListHeader } from "./ListHeader";

const meta: Meta<typeof ListHeader> = {
  title: "DesignSystem/ListHeader",
  component: ListHeader,
  args: {
    section: "Organizace",
    route: "/projects",
    title: "Projekty",
    count: [
      { text: "7 projektů", tone: "plain" },
      { text: "4 běhy běží", tone: "run" },
      { text: "3 čekají na tebe", tone: "warn" },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof ListHeader> = {};
