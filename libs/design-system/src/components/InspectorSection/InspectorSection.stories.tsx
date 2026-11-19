import type { Meta, StoryObj } from "@storybook/react";
import { InspectorSection } from "./InspectorSection";

const meta: Meta<typeof InspectorSection> = {
  title: "DesignSystem/InspectorSection",
  component: InspectorSection,
};
export default meta;

type Story = StoryObj<typeof InspectorSection>;

export const Overview: Story = {
  render: () => (
    <div className="w-[392px] border border-line bg-panel">
      <InspectorSection defaultOpen summary="Architect" title="Who">
        Body of the section.
      </InspectorSection>
      <InspectorSection invalid summary="Pick a file" title="Files">
        Files
      </InspectorSection>
      <InspectorSection summary="opus · high" title="Advanced">
        Advanced
      </InspectorSection>
    </div>
  ),
};
