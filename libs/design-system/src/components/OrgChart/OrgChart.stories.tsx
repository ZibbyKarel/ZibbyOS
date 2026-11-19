import type { Meta, StoryObj } from "@storybook/react";
import { OrgChart } from "./OrgChart";

const meta: Meta<typeof OrgChart> = {
  title: "DesignSystem/OrgChart",
  component: OrgChart,
  args: { root: "ZibbyCorp · 6", children: "cards" },
};
export default meta;
export const Default: StoryObj<typeof OrgChart> = {};
