import type { Meta, StoryObj } from "@storybook/react";
import { DenseRow, DenseRowList } from "./DenseRow";

const meta: Meta<typeof DenseRowList> = { title: "DesignSystem/DenseRow", component: DenseRowList };
export default meta;
export const Default: StoryObj<typeof DenseRowList> = {
  render: () => (
    <DenseRowList>
      <DenseRow
        cells={["Každou hodinu", "naposledy před 12 min"]}
        title="Úklid worktree"
        trailing="●"
      />
      <DenseRow
        cells={["Každý den ve 3:00", "naposledy dnes 3:00"]}
        title="Synchronizace skills"
        trailing="●"
      />
    </DenseRowList>
  ),
};
