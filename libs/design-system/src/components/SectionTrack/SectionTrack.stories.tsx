import type { Meta, StoryObj } from "@storybook/react";
import { SectionTrack } from "./SectionTrack";

const meta: Meta<typeof SectionTrack> = {
  title: "DesignSystem/SectionTrack",
  component: SectionTrack,
  args: {
    items: [
      { href: "/overview", label: "Dashboard", icon: "grid", active: true, attention: true },
      { href: "/runs", label: "Runs", icon: "play" },
      { href: "/memory", label: "Memory", icon: "stack" },
    ],
  },
};
export default meta;

export const Playground: StoryObj<typeof SectionTrack> = {};

export const IconOnly: StoryObj<typeof SectionTrack> = {
  args: {
    items: [
      { href: "/overview", label: "Dashboard", icon: "grid", active: true },
      { href: "/runs", label: "Runs", icon: "play", iconOnly: true },
    ],
  },
};
