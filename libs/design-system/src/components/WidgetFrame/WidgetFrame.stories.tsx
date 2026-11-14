import type { Meta, StoryObj } from "@storybook/react";
import { WidgetFrame } from "./WidgetFrame";

const meta: Meta<typeof WidgetFrame> = {
  title: "DesignSystem/WidgetFrame",
  component: WidgetFrame,
  parameters: { backgrounds: { default: "velin" } },
  args: {
    label: "Issues",
    count: "07",
    you: "2 for you",
    species: "groupedList",
    style: { left: 16, top: 16, width: 360, height: 220 },
    onToggleCollapse: () => {},
    onSettings: () => {},
    onMovePointerDown: () => {},
    children: <div className="p-4 text-[13px]">Rows go here</div>,
  },
  decorators: [(Story) => <div className="relative h-[260px]">{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof WidgetFrame>;

export const View: Story = {};
export const TierHero: Story = {
  args: { tier: "hero", species: "hero", label: "Briefing", count: undefined, you: undefined },
};
export const TierPrimary: Story = { args: { tier: "primary" } };
export const TierStandard: Story = { args: { tier: "standard" } };
export const TierAmbient: Story = { args: { tier: "ambient", count: "7", you: undefined } };
export const TierCollapsed: Story = {
  args: { tier: "collapsed", empty: true, you: undefined, count: undefined, aside: "All clear" },
};
export const CompactControls: Story = {
  args: {
    compactControls: true,
    onRefresh: () => {},
    onToggleFilters: () => {},
    style: { left: 16, top: 16, width: 240, height: 220 },
  },
};
export const Collapsed: Story = { args: { collapsed: true } };
export const EmptyAllClear: Story = { args: { empty: true, aside: "All clear" } };
export const Configurable: Story = { args: { onAdd: () => {} } };
export const WithFilters: Story = { args: { onToggleFilters: () => {}, onRefresh: () => {} } };
export const FiltersOpen: Story = { args: { ...WithFilters.args, filtersOpen: true } };
export const FiltersActive: Story = { args: { ...WithFilters.args, filtersActive: true } };
export const Adding: Story = { args: { ...Configurable.args, adding: true } };
export const Dragging: Story = { args: { dragging: true, sizeLabel: "4 × 6" } };
