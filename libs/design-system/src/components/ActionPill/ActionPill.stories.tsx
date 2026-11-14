import type { Meta, StoryObj } from "@storybook/react";
import { ActionPalette, ActionPill, ActionPillAdd } from "./ActionPill";

const meta: Meta<typeof ActionPill> = { title: "DesignSystem/ActionPill", component: ActionPill };
export default meta;

type Story = StoryObj<typeof ActionPill>;

export const Palette: Story = {
  render: () => (
    <div className="w-80">
      <ActionPalette>
        <ActionPill
          label="Deploy staging"
          leadLabel="Run"
          onLead={() => {}}
          onOpen={() => {}}
          sub="devops"
        />
        <ActionPill
          selected
          label="Triage inbox"
          leadLabel="Run"
          onLead={() => {}}
          onOpen={() => {}}
        />
        <ActionPillAdd onClick={() => {}}>Add</ActionPillAdd>
      </ActionPalette>
    </div>
  ),
};
