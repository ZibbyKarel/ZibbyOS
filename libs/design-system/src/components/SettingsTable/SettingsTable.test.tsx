import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsTable, SettingsTableTestId } from "./SettingsTable";

describe("SettingsTable", () => {
  it("renders one list item per row under a hidden header", () => {
    render(
      <SettingsTable
        columns={["Watcher", "Every", "Last tick", "State"]}
        rows={[
          { id: "a", cells: ["task-planner", "10 min", "2 min ago", "OK"] },
          { id: "b", attention: true, cells: ["ci-monitor", "5 min", "41 min ago", "Stale"] },
        ]}
      />,
    );
    expect(screen.getAllByTestId(SettingsTableTestId.Row)).toHaveLength(2);
    expect(screen.getByTestId(SettingsTableTestId.Head)).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("ci-monitor")).toBeInTheDocument();
  });
});
