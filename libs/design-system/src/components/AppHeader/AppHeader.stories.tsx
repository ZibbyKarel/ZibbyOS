import type { Meta, StoryObj } from "@storybook/react";
import { AppHeader } from "./AppHeader";
import { Icon } from "../Icon/Icon";
import {
  HeaderIconButton,
  HeaderModeButton,
  HeaderModeGroup,
  HeaderNewButton,
} from "../HeaderChrome/HeaderChrome";
import { SectionTrack } from "../SectionTrack/SectionTrack";

const nav = (
  <SectionTrack
    items={[
      { href: "/overview", label: "Dashboard", icon: "grid", active: true, attention: true },
      { href: "/runs", label: "Runs", icon: "play" },
      { href: "/memory", label: "Memory", icon: "stack" },
    ]}
  />
);

const zoneC = (autopilot: boolean) => ({
  mode: (
    <HeaderModeGroup ariaLabel="Operating mode">
      {autopilot ? (
        <HeaderModeButton live pressed label="Autopilot" />
      ) : (
        <HeaderModeButton pressed icon="compass" label="Approve" />
      )}
    </HeaderModeGroup>
  ),
  notifications: (
    <HeaderIconButton aria-label="Notifications, 5 unread" badge={5}>
      <Icon name="bell" size="lg" />
    </HeaderIconButton>
  ),
  preferences: (
    <HeaderIconButton aria-label="Preferences">
      <Icon name="gear" size="lg" />
    </HeaderIconButton>
  ),
});

const meta: Meta<typeof AppHeader> = {
  title: "DesignSystem/AppHeader",
  component: AppHeader,
  parameters: { backgrounds: { default: "velin" } },
};
export default meta;

type Story = StoryObj<typeof AppHeader>;

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <AppHeader homeHref="/overview" nav={nav} onSearchClick={() => {}} />
      <AppHeader
        create={<HeaderNewButton aria-haspopup="menu" label="New" />}
        homeHref="/overview"
        nav={nav}
        onSearchClick={() => {}}
        {...zoneC(false)}
      />
      <AppHeader
        create={<HeaderNewButton aria-haspopup="menu" label="New" />}
        homeHref="/overview"
        nav={nav}
        onSearchClick={() => {}}
        {...zoneC(true)}
      />
    </div>
  ),
};

export const Playground: Story = {
  args: { homeHref: "/overview", nav, onSearchClick: () => {}, ...zoneC(false) },
};
