import type { Meta, StoryObj } from "@storybook/react";
import { AvatarStack } from "./AvatarStack";

const meta: Meta<typeof AvatarStack> = {
  title: "DesignSystem/AvatarStack",
  component: AvatarStack,
  args: { items: [{ name: "Karel Z" }, { name: "Anna B" }, { name: "Cyril D" }], label: "3 osoby" },
};
export default meta;
export const Default: StoryObj<typeof AvatarStack> = {};
