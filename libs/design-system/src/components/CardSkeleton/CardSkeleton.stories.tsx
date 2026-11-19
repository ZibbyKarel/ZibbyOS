import type { Meta, StoryObj } from "@storybook/react";
import { CardSkeleton } from "./CardSkeleton";

const meta: Meta<typeof CardSkeleton> = {
  title: "DesignSystem/CardSkeleton",
  component: CardSkeleton,
};
export default meta;
type Story = StoryObj<typeof CardSkeleton>;
export const Card: Story = {};
export const Portrait: Story = { args: { shape: "portrait" } };
export const Wide: Story = { args: { shape: "wide" } };
export const Row: Story = { args: { shape: "row" } };
