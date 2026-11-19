import type { Meta, StoryObj } from "@storybook/react";
import { RegistryList } from "./RegistryList";
import { RegistryRow } from "../RegistryRow/RegistryRow";

const meta: Meta<typeof RegistryList> = {
  title: "DesignSystem/RegistryList",
  component: RegistryList,
};
export default meta;
export const Terminal: StoryObj<typeof RegistryList> = {
  render: () => (
    <RegistryList dashed terminalTitle="~/.zibby/commands">
      <RegistryRow lead="›">/review</RegistryRow>
      <RegistryRow lead="›">/ship</RegistryRow>
    </RegistryList>
  ),
};
