import type { Meta, StoryObj } from "@storybook/react";
import { PageTitle } from "./PageTitle";

const meta: Meta<typeof PageTitle> = {
  title: "DesignSystem/PageTitle",
  component: PageTitle,
  args: { children: "Můstek" },
};
export default meta;

export const Playground: StoryObj<typeof PageTitle> = {};
