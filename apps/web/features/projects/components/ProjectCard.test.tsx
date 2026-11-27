import type { Project, ProjectBudgetStatus, TaskRun, TaskRunStatus } from "@zibby/contracts";
import { BudgetBarsTestId, IconTileTestId } from "@zibby/design-system";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen, within } from "../../../test/render";
import { ProjectCard } from "./ProjectCard";

// The footer task stats read the same unified feed the runs screen does; stub it
// so the card gets a fixed set of runs across two projects.
let feed: TaskRun[] = [];
vi.mock("../../runs", () => ({
  useRunsQuery: () => ({ runs: feed }),
}));

let seq = 0;
function taskRun(projectId: string | undefined, statusValue: TaskRunStatus): TaskRun {
  return {
    runId: `${projectId ?? "none"}-${statusValue}-${seq++}`,
    kind: "agent",
    owner: "",
    status: statusValue,
    pct: null,
    title: "",
    prompt: "",
    project: "",
    startedAt: "2026-07-05T00:00:00.000Z",
    ...(projectId ? { projectId } : {}),
  } as TaskRun;
}

beforeEach(() => {
  feed = [];
});

const project = (over: Partial<Project> = {}): Project => ({
  id: "alpha",
  name: "Alpha",
  path: "~/Projects/alpha",
  ...over,
});

const status = (over: Partial<ProjectBudgetStatus> = {}): ProjectBudgetStatus => ({
  projectId: "alpha",
  name: "Alpha",
  daily: { used: 1, cap: 2 },
  weekly: { used: 1 },
  running: 1,
  queued: 0,
  held: 0,
  ...over,
});

describe("ProjectCard budget", () => {
  it("shows a usage bar per capped window with the exact numbers as tooltip", () => {
    render(<ProjectCard budget={status()} project={project({ budget: { dailyRuns: 2 } })} />);
    const items = screen.getAllByTestId(BudgetBarsTestId.Item);
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAttribute("title", "1/2");
    expect(items[0]).toHaveTextContent("50 %");
  });

  it("prefers the dollar cap over the run cap for the same window", () => {
    render(
      <ProjectCard
        budget={status({ dailyCost: { spentUsd: 1.5, capUsd: 5 } })}
        project={project({ budget: { dailyRuns: 2, dailyCostCapUsd: 5 } })}
      />,
    );
    expect(screen.getByTestId(BudgetBarsTestId.Item)).toHaveAttribute(
      "title",
      "1/2 · $1.50 / $5.00",
    );
  });

  it("hides budget bars entirely when the project has no budget", () => {
    render(<ProjectCard budget={status()} project={project()} />);
    expect(screen.queryByTestId(BudgetBarsTestId.Root)).toBeNull();
  });

  it("surfaces the held count when tasks are held over budget", () => {
    render(
      <ProjectCard budget={status({ held: 2 })} project={project({ budget: { dailyRuns: 1 } })} />,
    );
    expect(screen.getByText(/pozdrženo 2/)).toBeInTheDocument();
  });
});

function statValue(key: string): string {
  const link = screen.getByTestId(`project-card-stat-${key}`);
  return within(link).getByText(/^\d+$/).textContent ?? "";
}

describe("ProjectCard task stats (Phase 52)", () => {
  it("shows the per-status task counts (bucketed) plus the total", () => {
    feed = [
      taskRun("alpha", "running"),
      taskRun("alpha", "done"),
      taskRun("alpha", "done"),
      taskRun("alpha", "queued"), // → waiting bucket
      taskRun("alpha", "awaiting-approval"), // → waiting bucket
      taskRun("beta", "error"), // other project — excluded
    ];
    render(<ProjectCard project={project()} />);

    expect(statValue("running")).toBe("1");
    expect(statValue("waiting")).toBe("2");
    expect(statValue("done")).toBe("2");
    expect(statValue("error")).toBe("0");
    expect(statValue("parked")).toBe("0");
    expect(statValue("total")).toBe("5");
  });

  it("deep-links each stat into /activity/runs pre-filtered to this project and the bucket's states (F8d — /runs is deleted; /activity/runs doesn't yet read these params, a pre-existing F2 gap)", () => {
    feed = [taskRun("alpha", "done")];
    render(<ProjectCard project={project()} />);

    expect(screen.getByTestId("project-card-stat-done")).toHaveAttribute(
      "href",
      "/activity/runs?project=alpha&filter=done",
    );
    expect(screen.getByTestId("project-card-stat-waiting")).toHaveAttribute(
      "href",
      "/activity/runs?project=alpha&filter=queued,scheduled,pending,held,awaiting-approval",
    );
  });
});

describe("ProjectCard logo", () => {
  it("renders the project's custom logo when set", () => {
    render(<ProjectCard project={project({ logo: "data:image/png;base64,AAA" })} />);
    const img = screen.getByTestId(IconTileTestId.Image);
    expect(img).toHaveAccessibleName("Alpha");
    expect(img).toHaveAttribute("src", "data:image/png;base64,AAA");
  });

  it("falls back to the code glyph when the project has no logo", () => {
    render(<ProjectCard project={project()} />);
    expect(screen.queryByTestId(IconTileTestId.Image)).toBeNull();
  });
});

describe("ProjectCard other-machine badge (multi-company phase 1)", () => {
  it("shows the badge only when otherMachine is set", () => {
    const { rerender } = render(<ProjectCard project={project()} />);
    expect(screen.queryByText("patří jinému stroji")).toBeNull();
    rerender(<ProjectCard otherMachine project={project()} />);
    expect(screen.getByText("patří jinému stroji")).toBeTruthy();
  });
});
