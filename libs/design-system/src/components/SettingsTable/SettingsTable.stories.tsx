import type { Meta, StoryObj } from "@storybook/react";
import { SettingsTable } from "./SettingsTable";

const meta: Meta<typeof SettingsTable> = {
  title: "DesignSystem/SettingsTable",
  component: SettingsTable,
  args: {
    columns: ["Watcher", "Every", "Last tick", "State"],
    rows: [
      { id: "a", cells: ["task-planner", "10 min", "2 min ago", "OK"] },
      { id: "b", attention: true, cells: ["ci-monitor", "5 min", "41 min ago", "Stale"] },
    ],
  },
};
export default meta;

export const Default: StoryObj<typeof SettingsTable> = {};
