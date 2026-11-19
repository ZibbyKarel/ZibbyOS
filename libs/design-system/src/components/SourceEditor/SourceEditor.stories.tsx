import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { SourceEditor } from "./SourceEditor";

const meta: Meta<typeof SourceEditor> = {
  title: "DesignSystem/SourceEditor",
  component: SourceEditor,
};
export default meta;

export const Overview: StoryObj<typeof SourceEditor> = {
  render: () => {
    const [value, setValue] = useState(
      "# Reviewer\n\nYou review diffs.\n\n## Process\n1. Read the **plan**.\n- Run `pnpm test`\n",
    );
    return (
      <div className="h-80 w-[640px] border border-line bg-panel">
        <SourceEditor ariaLabel="Instructions" onChange={setValue} value={value} />
      </div>
    );
  },
};
