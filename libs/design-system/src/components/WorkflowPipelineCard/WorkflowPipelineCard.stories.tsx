import type { Meta, StoryObj } from "@storybook/react";
import { WorkflowPipelineCard } from "./WorkflowPipelineCard";

const meta: Meta<typeof WorkflowPipelineCard> = {
  title: "DesignSystem/WorkflowPipelineCard",
  component: WorkflowPipelineCard,
  args: {
    icon: "→",
    title: "Od issue k PR",
    description: "Z issue s labelem „ready“ udělá naplánovanou a otestovanou změnu.",
    nodes: [
      { id: "a", index: "01", name: "Plán", who: "Architekt", engine: "C", state: "done" },
      { id: "b", index: "02", name: "Implementace", who: "Kodér", engine: "OC", state: "active" },
      { id: "c", index: "03", name: "Testy", who: "Tester", engine: "BC" },
    ],
    output: { label: "Pull request" },
  },
};
export default meta;
export const Default: StoryObj<typeof WorkflowPipelineCard> = {};
