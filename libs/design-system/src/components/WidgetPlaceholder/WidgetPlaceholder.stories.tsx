import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button/Button";
import { WidgetPlaceholder } from "./WidgetPlaceholder";

const meta: Meta<typeof WidgetPlaceholder> = {
  title: "DesignSystem/WidgetPlaceholder",
  component: WidgetPlaceholder,
};
export default meta;

export const Default: StoryObj<typeof WidgetPlaceholder> = {
  render: () => (
    <div className="relative h-[160px] w-[320px]">
      <WidgetPlaceholder style={{ left: 0, top: 0, width: 320, height: 160 }}>
        <Button icon="plus" intent="ghost" size="sm">
          Add widget
        </Button>
      </WidgetPlaceholder>
    </div>
  ),
};
