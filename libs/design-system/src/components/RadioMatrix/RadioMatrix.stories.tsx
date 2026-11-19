import type { Meta, StoryObj } from "@storybook/react";
import { RadioMatrix } from "./RadioMatrix";

const meta: Meta<typeof RadioMatrix> = {
  title: "DesignSystem/RadioMatrix",
  component: RadioMatrix,
  args: {
    ariaLabel: "Live log",
    rowHeader: "Event group",
    columns: [
      { id: "visible", label: "Visible" },
      { id: "grouped", label: "Grouped" },
      { id: "hidden", label: "Hidden" },
    ],
    rows: [
      { id: "tasks", label: "Tasks", hint: "Created, started, done", value: "visible" },
      { id: "runs", label: "Runs", hint: "Agent runs and steps", value: "grouped" },
    ],
    onChange: () => {},
    caption: "Grouped folds bursts into one line.",
  },
};
export default meta;

type Story = StoryObj<typeof RadioMatrix>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
