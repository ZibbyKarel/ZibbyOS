import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "../Icon/Icon";
import {
  HeaderIconButton,
  HeaderModeButton,
  HeaderModeGroup,
  HeaderNewButton,
  HeaderStatus,
} from "./HeaderChrome";

const meta: Meta = {
  title: "DesignSystem/HeaderChrome",
  parameters: { backgrounds: { default: "velin" } },
};
export default meta;

export const Controls: StoryObj = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <HeaderNewButton aria-label="Create" label="New" />
      <HeaderStatus aria-label="System status" />
      <HeaderStatus
        attention
        aria-label="1 item waits"
        state="blocked"
        update={<Icon name="upgrade" size="xs" />}
      />
      <HeaderModeGroup ariaLabel="Operating mode">
        <HeaderModeButton pressed icon="compass" label="Approve" />
      </HeaderModeGroup>
      <HeaderModeGroup ariaLabel="Operating mode">
        <HeaderModeButton live pressed label="Autopilot" />
      </HeaderModeGroup>
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
