import { describe, expect, it } from "vitest";
import type { GoalInstance } from "@zibby/contracts";
import { renderWithProviders as render, screen } from "../../../test/render";
import { GoalStepsPanel, GoalStepsTestId } from "./GoalStepsPanel";

const names = { projectName: (id: string) => `P:${id}`, companyName: (id: string) => id };

const instance: GoalInstance = {
  status: "acting",
  taskIds: [],
  steps: [
    { id: "s1", title: "Kniha 1", status: "done" },
    { id: "s2", title: "Kniha 2", status: "running", taskId: "t1" },
    { id: "s3", title: "Kniha 3", status: "failed", note: "Export spadl" },
    { id: "s4", title: "Kniha 4", status: "blocked", note: "Čeká na obrázky" },
    { id: "s5", title: "Kniha 5", status: "pending" },
    { id: "s6", title: "Kniha 6", status: "skipped" },
  ],
};

describe("GoalStepsPanel", () => {
  it("lists every step with its title and status; failed and blocked show the note", () => {
    render(<GoalStepsPanel instances={{ _: instance }} names={names} />);
    expect(screen.getByTestId(`${GoalStepsTestId.Title}-_-s1`)).toHaveTextContent("Kniha 1");
    expect(screen.getByTestId(`${GoalStepsTestId.Status}-_-s1`)).toHaveTextContent("Hotovo");
    expect(screen.getByTestId(`${GoalStepsTestId.Status}-_-s2`)).toHaveTextContent("Běží");
    expect(screen.getByTestId(`${GoalStepsTestId.Status}-_-s3`)).toHaveTextContent("Selhalo");
    expect(screen.getByTestId(`${GoalStepsTestId.Status}-_-s4`)).toHaveTextContent("Blokováno");
    expect(screen.getByTestId(`${GoalStepsTestId.Status}-_-s5`)).toHaveTextContent("Čeká");
    expect(screen.getByTestId(`${GoalStepsTestId.Status}-_-s6`)).toHaveTextContent("Přeskočeno");
    expect(screen.getByTestId(`${GoalStepsTestId.Note}-_-s3`)).toHaveTextContent("Export spadl");
    expect(screen.getByTestId(`${GoalStepsTestId.Note}-_-s4`)).toHaveTextContent("Čeká na obrázky");
    expect(screen.queryByTestId(`${GoalStepsTestId.Note}-_-s1`)).not.toBeInTheDocument();
  });

  it("renders nothing when no instance has steps", () => {
    render(<GoalStepsPanel instances={{ a: { status: "acting", taskIds: [] } }} names={names} />);
    expect(screen.queryByTestId(GoalStepsTestId.List)).not.toBeInTheDocument();
  });

  it("labels each instance by project when there are several", () => {
    render(<GoalStepsPanel instances={{ a: instance, b: instance }} names={names} />);
    expect(screen.getByTestId(`${GoalStepsTestId.Group}-a`)).toHaveTextContent("P:a");
    expect(screen.getByTestId(`${GoalStepsTestId.Group}-b`)).toHaveTextContent("P:b");
  });
});
