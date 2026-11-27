import type { Meta, StoryObj } from "@storybook/react";
import { LogoUpload } from "./LogoUpload";

const meta: Meta<typeof LogoUpload> = {
  title: "DesignSystem/LogoUpload",
  component: LogoUpload,
  args: { fallback: "AC", changeLabel: "Change logo", removeLabel: "Remove", onSelect: () => {} },
};
export default meta;
export const Default: StoryObj<typeof LogoUpload> = {};
