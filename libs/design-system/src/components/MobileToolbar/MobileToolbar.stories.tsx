import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "../Icon/Icon";
import { HeaderIconButton } from "../HeaderChrome/HeaderChrome";
import { BrandMark } from "../BrandMark/BrandMark";
import { MobileToolbar } from "./MobileToolbar";

const meta: Meta<typeof MobileToolbar> = {
  title: "DesignSystem/MobileToolbar",
  component: MobileToolbar,
  parameters: { backgrounds: { default: "velin" } },
  args: {
    leading: (
      <HeaderIconButton aria-label="Menu">
        <Icon name="menu" size="lg" />
      </HeaderIconButton>
    ),
    brand: <BrandMark size={24} />,
    title: "Dashboard",
    actions: (
      <HeaderIconButton aria-label="Notifications" badge={5}>
        <Icon name="bell" size="lg" />
      </HeaderIconButton>
    ),
  },
};
export default meta;

export const Playground: StoryObj<typeof MobileToolbar> = {};

export const AutopilotOn: StoryObj<typeof MobileToolbar> = {
  args: {
    banner: (
      <>
        <b>Autopilot on</b> · agents act without asking
      </>
    ),
    bannerAction: <a href="/settings">Change</a>,
  },
};
