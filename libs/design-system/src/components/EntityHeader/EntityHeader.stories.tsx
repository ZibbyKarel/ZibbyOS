import type { Meta, StoryObj } from "@storybook/react";
import { IconTile } from "../IconTile/IconTile";
import { EntityHeader } from "./EntityHeader";

const meta: Meta<typeof EntityHeader> = {
  title: "DesignSystem/EntityHeader",
  component: EntityHeader,
  args: {
    mark: <IconTile glyph="building" size="xl" />,
    title: "Acme Logistics",
    lede: "Freight booking and warehouse software.",
    eyebrow: "company · acme-logistics",
    summary: "4 integrations connected · 2 teams · 5 projects",
  },
};
export default meta;
type Story = StoryObj<typeof EntityHeader>;
export const Company: Story = { args: { variant: "company" } };
export const Project: Story = {
  args: { variant: "project", title: "checkout-api", titleMeta: "github.com/acme/checkout-api" },
};
export const Team: Story = { args: { variant: "team", title: "Platform" } };
