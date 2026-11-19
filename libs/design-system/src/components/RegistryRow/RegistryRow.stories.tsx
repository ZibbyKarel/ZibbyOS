import type { Meta, StoryObj } from "@storybook/react";
import { RegistryRow } from "./RegistryRow";

const meta: Meta<typeof RegistryRow> = {
  title: "DesignSystem/RegistryRow",
  component: RegistryRow,
  decorators: [
    (Story) => (
      <ul style={{ listStyle: "none", padding: 0 }}>
        <Story />
      </ul>
    ),
  ],
  args: { lead: "›", children: "/review", trailing: "auto" },
};
export default meta;
export const Default: StoryObj<typeof RegistryRow> = {};
