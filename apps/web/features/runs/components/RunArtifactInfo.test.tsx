import { renderWithProviders as render, screen } from "../../../test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { RunView } from "../run";
import { RunArtifactInfo, RunArtifactInfoTestId } from "./RunArtifactInfo";

const { prUrl } = vi.hoisted(() => ({ prUrl: { current: undefined as string | undefined } }));
vi.mock("../useRunPrUrl", () => ({ useRunPrUrl: () => prUrl.current }));

const run = {
  runId: "delivery_42",
  kind: "workflow",
  owner: "delivery",
  status: "done",
  pct: null,
  title: "",
  prompt: "",
  project: "",
  startedAt: "2026-10-20T10:00:00Z",
  logBase: null,
  folderPath: "/data/runs/delivery_42",
} as RunView;

describe("RunArtifactInfo", () => {
  beforeEach(() => {
    prUrl.current = undefined;
  });

  it("shows a PR and opens it", async () => {
    prUrl.current = "https://github.com/a/b/pull/9";
    const onOpenPr = vi.fn();
    render(<RunArtifactInfo done onOpenPr={onOpenPr} run={run} />);
    expect(screen.getByTestId(RunArtifactInfoTestId.Path)).toHaveTextContent(
      "github.com/a/b/pull/9",
    );
    await userEvent.click(screen.getByTestId(RunArtifactInfoTestId.Open));
    expect(onOpenPr).toHaveBeenCalledWith("https://github.com/a/b/pull/9");
  });

  it("shows the folder path with an open button", async () => {
    const onOpenFolder = vi.fn();
    render(<RunArtifactInfo done onOpenFolder={onOpenFolder} run={run} />);
    expect(screen.getByTestId(RunArtifactInfoTestId.Path)).toHaveTextContent(
      "/data/runs/delivery_42",
    );
    await userEvent.click(screen.getByTestId(RunArtifactInfoTestId.Open));
    expect(onOpenFolder).toHaveBeenCalledOnce();
  });

  it("shows a delivered file's path", () => {
    render(
      <RunArtifactInfo
        done
        run={{
          ...run,
          outputArtifactName: "report.md",
          outputFilePath: "/data/runs/delivery_42/02_x/report.md",
        }}
      />,
    );
    expect(screen.getByTestId(RunArtifactInfoTestId.Path)).toHaveTextContent(
      "/data/runs/delivery_42/02_x/report.md",
    );
  });

  it("stays silent until the run is done", () => {
    render(<RunArtifactInfo done={false} run={run} />);
    expect(screen.queryByTestId(RunArtifactInfoTestId.Root)).not.toBeInTheDocument();
  });
});
