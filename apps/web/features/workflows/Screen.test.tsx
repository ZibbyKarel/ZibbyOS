import { renderWithProviders as render, screen } from "../../test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Agent, UpdateWorkflowInput } from "@zibby/contracts";
import type { Workflow } from "../../domain";
import { OperatorTokenNoticeTestId } from "../ai-providers/components/OperatorTokenNotice";
import { WorkflowCardTestId } from "./components/WorkflowCard/WorkflowCard";
import { InspectorTestId } from "./components/WorkflowEditor/Inspector";
import { PhaseCardTestId } from "./components/WorkflowEditor/PhaseCard";
import { WorkflowBarTestId } from "./components/WorkflowEditor/WorkflowBar";
import { Screen, ScreenTestId } from "./Screen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const AGENTS: Agent[] = [
  { id: "writer", name: "Writer", glyph: "edit", instructions: "write" },
  { id: "tester", name: "Tester", glyph: "flask", instructions: "test" },
];

const WORKFLOW: Workflow = {
  id: "build-feature",
  name: "Build Feature",
  lastRun: "dnes 03:12",
  lastState: "parked",
  desc: "spec → impl → test",
  file: "f",
  outputs: [],
  phases: [],
};

// A workflow with an existing chain (agent → verify with a rework loop back to
// the agent) — mirrors the fixture the old `WorkflowDialog.test.tsx` edit-mode
// suite used, now exercised through the inline detail-view editor instead.
const EXISTING: Workflow = {
  id: "delivery",
  name: "Delivery",
  lastRun: "—",
  lastState: "done",
  desc: "build → verify",
  file: "f",
  outputs: [],
  phases: [
    {
      id: "koder",
      type: "agent",
      agent: "writer",
      consumes: "task.md",
      produces: "implementation.md",
      model: "sonnet",
      thinking: "medium",
    },
    {
      id: "verify",
      type: "agent",
      agent: "writer",
      consumes: "implementation.md",
      produces: "verdict.md",
      model: "sonnet",
      thinking: "medium",
      loop: { to: "koder", maxRetries: 2, escalate: true, then: "fail" },
    },
  ],
};

const { hooks } = vi.hoisted(() => ({
  hooks: {
    workflows: {
      data: [] as Workflow[],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    },
    update: vi.fn(),
    duplicate: { mutate: vi.fn(), isPending: false, error: undefined as unknown },
  },
}));

vi.mock("./queries", () => ({
  useWorkflowsQuery: () => hooks.workflows,
  useWorkflowRunsQuery: () => ({ data: [] }),
  useWorkflowRunQuery: () => ({ data: undefined }),
}));
vi.mock("./mutations", () => ({
  useCreateWorkflowMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateWorkflowMutation: () => ({ mutate: hooks.update, isPending: false }),
  useDuplicateWorkflowMutation: () => hooks.duplicate,
  duplicateWorkflowBody: vi.fn(),
}));
vi.mock("../agents", () => ({ useAgentsQuery: () => ({ data: AGENTS }) }));
vi.mock("../tasks", () => ({ useNewTask: () => ({ open: vi.fn() }) }));
vi.mock("../departments/useDepartmentLookup", () => ({
  useDepartmentLookup: () => ({
    list: [],
    get: (id: string) => (id === "delivery" ? { name: "Delivery", color: "#fff" } : undefined),
  }),
}));

const OWNED: Workflow = { ...WORKFLOW, id: "ship", name: "Ship", department: "delivery" };

describe("workflows Screen — list and detail route", () => {
  const withList = () => {
    hooks.workflows = {
      data: [WORKFLOW, OWNED],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
    push.mockReset();
  };

  it("list route: one section per department plus an unowned group, cards inside", () => {
    withList();
    render(<Screen />);
    const groups = screen.getAllByTestId(ScreenTestId.Group);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent("Delivery");
    expect(groups[0]).toHaveTextContent("Ship");
    expect(groups[1]).toHaveTextContent("Bez oddělení");
    expect(groups[1]).toHaveTextContent("Build Feature");
    expect(screen.getAllByTestId(WorkflowCardTestId.Root)).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Workflow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Přidat workflow" })).toBeInTheDocument();
  });

  it("clicking a card navigates to its detail route", async () => {
    withList();
    render(<Screen />);
    await userEvent.click(screen.getAllByTestId(WorkflowCardTestId.Root)[0]!);
    expect(push).toHaveBeenCalledWith("/work/workflows/ship");
  });

  it("with selectedId the full page replaces the list", () => {
    withList();
    render(<Screen selectedId="build-feature" />);
    expect(screen.getByTestId("wd-screen")).toBeInTheDocument();
    expect(screen.getByTestId(WorkflowBarTestId.Root)).toHaveTextContent("Build Feature");
    expect(screen.queryAllByTestId(ScreenTestId.Group)).toHaveLength(0);
  });

  it("the breadcrumb navigates back to the list route", async () => {
    withList();
    render(<Screen selectedId="build-feature" />);
    await userEvent.click(screen.getByTestId(WorkflowBarTestId.Back));
    expect(push).toHaveBeenCalledWith("/work/workflows");
  });

  it("department tab basePath: the breadcrumb returns to that basePath", async () => {
    withList();
    render(<Screen basePath="/workforce/departments/delivery/workflows" selectedId="ship" />);
    await userEvent.click(screen.getByTestId(WorkflowBarTestId.Back));
    expect(push).toHaveBeenCalledWith("/workforce/departments/delivery/workflows");
  });

  it("unknown selectedId: no page, the grid still renders", () => {
    withList();
    render(<Screen selectedId="nope" />);
    expect(screen.queryByTestId("wd-screen")).toBeNull();
    expect(screen.getAllByTestId(WorkflowCardTestId.Root)).toHaveLength(2);
  });
});

describe("workflows Screen — page editing", () => {
  const open = () => {
    hooks.workflows = { data: [EXISTING], isPending: false, isError: false, refetch: vi.fn() };
    hooks.update.mockReset();
    render(<Screen selectedId="delivery" />);
  };
  const cards = () => screen.getAllByTestId(PhaseCardTestId.Root);

  it("read mode shows one card per phase and no save", () => {
    open();
    expect(cards()).toHaveLength(2);
    expect(screen.getByTestId(WorkflowBarTestId.Edit)).toBeInTheDocument();
    expect(screen.queryByTestId(WorkflowBarTestId.Save)).toBeNull();
  });

  it("Edit opens the palette; Save stays disabled until something changes", async () => {
    open();
    await userEvent.click(screen.getByTestId(WorkflowBarTestId.Edit));
    expect(screen.getByTestId(WorkflowBarTestId.Save)).toBeDisabled();
    expect(screen.getByTestId("workflow-palette-agent-tester")).toBeInTheDocument();
    expect(cards()).toHaveLength(2);
  });

  it("adding an agent marks the page dirty, selects the new card and Save PATCHes only phases", async () => {
    open();
    hooks.update.mockImplementation((_a: unknown, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    );
    await userEvent.click(screen.getByTestId(WorkflowBarTestId.Edit));
    await userEvent.click(screen.getByTestId("workflow-palette-agent-tester"));
    expect(cards()).toHaveLength(3);
    expect(screen.getByTestId(WorkflowBarTestId.Dirty)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId(WorkflowBarTestId.Save));
    const [{ params, body }] = hooks.update.mock.calls[0] as [
      { params: { id: string }; body: UpdateWorkflowInput },
    ];
    expect(params).toEqual({ id: "delivery" });
    expect(Object.keys(body)).toEqual(["phases"]);
    expect(body.phases).toHaveLength(3);
    expect(screen.queryByTestId(WorkflowBarTestId.Save)).toBeNull();
  });

  it("Cancel discards the in-progress edit", async () => {
    open();
    await userEvent.click(screen.getByTestId(WorkflowBarTestId.Edit));
    await userEvent.click(screen.getByTestId("workflow-palette-agent-tester"));
    expect(cards()).toHaveLength(3);
    await userEvent.click(screen.getByTestId(WorkflowBarTestId.Cancel));
    expect(hooks.update).not.toHaveBeenCalled();
    expect(cards()).toHaveLength(2);
  });

  it("selecting a card shows its inspector, Esc closes it", async () => {
    open();
    await userEvent.click(cards()[0]!);
    expect(screen.getByTestId("wd-phase-koder")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("wd-phase-koder")).toBeNull();
    expect(screen.getByTestId(InspectorTestId.Settings)).toBeInTheDocument();
  });

  it("a problem disables Save and surfaces the problems menu", async () => {
    open();
    await userEvent.click(screen.getByTestId(WorkflowBarTestId.Edit));
    await userEvent.click(screen.getByTestId("workflow-palette-agent-tester"));
    expect(screen.queryByTestId(WorkflowBarTestId.Problems)).toBeNull();

    // The new phase is selected; clearing its output file is a validation problem.
    await userEvent.click(screen.getByText("Soubory"));
    await userEvent.clear(screen.getByLabelText("Výstupní soubor"));

    expect(screen.getByTestId(WorkflowBarTestId.Problems)).toBeInTheDocument();
    expect(screen.getByTestId(WorkflowBarTestId.Save)).toBeDisabled();
  });
});

describe("workflows Screen — duplicate", () => {
  const open = (error: unknown) => {
    hooks.workflows = { data: [EXISTING], isPending: false, isError: false, refetch: vi.fn() };
    hooks.duplicate = { mutate: vi.fn(), isPending: false, error };
    render(<Screen selectedId="delivery" />);
  };

  it("shows the operator-token notice on a 401", () => {
    open({ status: 401, body: {} });
    expect(screen.getByTestId(OperatorTokenNoticeTestId.Root)).toBeInTheDocument();
  });

  it("shows no notice without an error or on another status", () => {
    open(undefined);
    expect(screen.queryByTestId(OperatorTokenNoticeTestId.Root)).toBeNull();
  });

  it("shows no notice on a non-401 error", () => {
    open({ status: 500, body: {} });
    expect(screen.queryByTestId(OperatorTokenNoticeTestId.Root)).toBeNull();
  });
});
