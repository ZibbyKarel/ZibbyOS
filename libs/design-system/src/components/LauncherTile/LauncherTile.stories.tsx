import type { Meta, StoryObj } from "@storybook/react";
import { LauncherGrid, LauncherTile } from "./LauncherTile";

const meta: Meta<typeof LauncherTile> = {
  title: "DesignSystem/LauncherTile",
  component: LauncherTile,
};
export default meta;

type Story = StoryObj<typeof LauncherTile>;

export const Grid: Story = {
  render: () => (
    <div className="w-72">
      <LauncherGrid>
        <LauncherTile icon="bot" label="Reviewer" onClick={() => {}} />
        <LauncherTile icon="flow" label="Nightly research" onClick={() => {}} />
        <LauncherTile icon="layout" label="Overview" onClick={() => {}} />
      </LauncherGrid>
    </div>
  ),
};
