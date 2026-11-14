import type { Meta, StoryObj } from "@storybook/react";
import { SummaryRow } from "./SummaryRow";

const meta: Meta<typeof SummaryRow> = {
  title: "DesignSystem/SummaryRow",
  component: SummaryRow,
  args: { icon: "grid", label: "Stav projektů", value: "1 selhává", onClick: () => {} },
};
export default meta;

type Story = StoryObj<typeof SummaryRow>;

export const Playground: Story = {};
export const List: Story = {
  render: () => (
    <div className="max-w-[360px]">
      <SummaryRow icon="grid" label="Stav projektů" onClick={() => {}} value="4 · 1 selhává" />
      <SummaryRow icon="clock" label="Automatizace" onClick={() => {}} value="3" />
      <SummaryRow expanded icon="pen" label="TODO" onClick={() => {}} value="3" />
    </div>
  ),
};
