import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "../Icon/Icon";
import { HeaderIconButton, HeaderNewButton } from "./HeaderChrome";

const meta: Meta = {
  title: "DesignSystem/HeaderChrome",
  parameters: { backgrounds: { default: "velin" } },
};
export default meta;

export const Controls: StoryObj = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <HeaderNewButton aria-label="Create" label="New" />
      <HeaderIconButton aria-label="Notifications" badge={5}>
        <Icon name="bell" />
      </HeaderIconButton>
      <HeaderIconButton aria-label="Notifications" badge={5} badgeTone="attention">
        <Icon name="bell" />
      </HeaderIconButton>
      <HeaderIconButton aria-label="Settings">
        <Icon name="gear" />
      </HeaderIconButton>
    </div>
  ),
};
