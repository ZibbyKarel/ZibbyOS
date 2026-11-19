import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkflowPipelineCard, WorkflowPipelineCardTestId } from "./WorkflowPipelineCard";

const nodes = [
  {
    id: "a",
    index: "01",
    name: "Plán",
    who: "Architekt",
    engine: "claude",
    state: "done" as const,
  },
  { id: "b", index: "02", name: "Implementace", who: "Kodér", state: "active" as const },
];

describe("WorkflowPipelineCard", () => {
  it("renders nodes, connectors and the output pill", async () => {
    const onClick = vi.fn();
    render(
      <WorkflowPipelineCard
        icon={<i />}
        nodes={nodes}
        onClick={onClick}
        output={{ label: "Pull request" }}
        title="Od issue k PR"
      />,
    );
    expect(screen.getAllByTestId(WorkflowPipelineCardTestId.Node)).toHaveLength(2);
    // between the nodes and before the output
    expect(screen.getAllByTestId(WorkflowPipelineCardTestId.Connector)).toHaveLength(2);
    expect(screen.getByTestId(WorkflowPipelineCardTestId.Output)).toHaveTextContent("Pull request");
    expect(screen.getAllByTestId(WorkflowPipelineCardTestId.Node)[1]).toHaveAttribute(
      "data-state",
      "active",
    );
    await userEvent.click(screen.getByTestId(WorkflowPipelineCardTestId.Root));
    expect(onClick).toHaveBeenCalled();
  });

  it("has no trailing connector without an output", () => {
    render(<WorkflowPipelineCard icon={<i />} nodes={nodes} title="x" />);
    expect(screen.getAllByTestId(WorkflowPipelineCardTestId.Connector)).toHaveLength(1);
  });
});
