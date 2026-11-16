import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it } from "vitest";
import type { Automation } from "@zibby/contracts";
import { EngineBadgeTestId } from "@zibby/design-system";
import { AutomationCard, AutomationCardTestId } from "./AutomationCard";

const base: Automation = {
  id: "daily-brief",
  name: "Daily briefing",
  trigger: { type: "cron", expr: "0 9 * * *" },
  target: { type: "briefing" },
  enabled: true,
  system: false,
};

const noop = () => {};
const renderCard = (over: Partial<Automation>) =>
  render(
    <AutomationCard
      automation={{ ...base, ...over }}
      onEdit={noop}
      onToggle={noop}
      onTrigger={noop}
    />,
  );

describe("AutomationCard (38) — honest next-run", () => {
  it("shows a next-run time for an enabled cron automation", () => {
    renderCard({ enabled: true });
    // "příště {when}" (cs)
    expect(screen.getByText(/příště/)).toBeInTheDocument();
  });

  it("shows 'off · won't run' for a disabled automation — not a phantom next-run", () => {
    renderCard({ enabled: false });
    expect(screen.getByText("vypnuto · nepoběží")).toBeInTheDocument();
    expect(screen.queryByText(/příště/)).not.toBeInTheDocument();
  });
});

describe("AutomationCard — system automations", () => {
  it("leaves the enable toggle interactive for a system automation (the storage layer allows the enabled patch)", () => {
    renderCard({ system: true });
    expect(screen.getByTestId(AutomationCardTestId.Toggle)).not.toBeDisabled();
  });

  it("leaves the enable toggle interactive for a user automation", () => {
    renderCard({ system: false });
    expect(screen.getByTestId(AutomationCardTestId.Toggle)).not.toBeDisabled();
  });
});

describe("AutomationCard — signal trigger", () => {
  it("renders the signal kind as the trigger value", () => {
    renderCard({ trigger: { type: "signal", kind: "cve", from: "sec" } });
    expect(screen.getByTestId(AutomationCardTestId.Schedule)).toHaveTextContent("cve");
  });
});

describe("AutomationCard — target rendering", () => {
  it("renders the memory-distill target with its label", () => {
    renderCard({ target: { type: "memory-distill" }, system: true });
    expect(screen.getByTestId(AutomationCardTestId.Target)).toHaveTextContent("Destilace paměti");
  });

  it("F4c: renders the self-knowledge target with its label + glyph", () => {
    renderCard({ target: { type: "self-knowledge" }, system: true });
    expect(screen.getByTestId(AutomationCardTestId.Target)).toHaveTextContent(
      "Obnova sebeznalosti",
    );
  });
});

describe("AutomationCard — task target (Phase 116e)", () => {
  it("renders the @-mentioned agent's name and resolves an agent glyph", () => {
    renderCard({
      target: {
        type: "task",
        text: "Zkontroluj otevřené PR",
        target: { kind: "agent", id: "builder", name: "Builder", glyph: "hammer" },
      },
    });
    const target = screen.getByTestId(AutomationCardTestId.Target);
    expect(target).toHaveTextContent("Builder");
    expect(screen.getByText("Daily briefing")).toBeInTheDocument();
  });

  it("falls back to the generic 'prompt task' label when unrouted (no @-mention)", () => {
    renderCard({ target: { type: "task", text: "Zkontroluj otevřené PR" } });
    expect(screen.getByTestId(AutomationCardTestId.Target)).toHaveTextContent("prompt úkol");
  });
});

describe("AutomationCard — engine badge", () => {
  it("badges an agent automation with its own engine override; a workflow gets none", () => {
    renderCard({ target: { type: "agent", agentId: "a" }, engine: "opencode" });
    expect(screen.getByTestId(EngineBadgeTestId.Badge)).toHaveAttribute("data-engine", "opencode");
  });

  it("shows no badge for a workflow target", () => {
    renderCard({ target: { type: "workflow", workflowId: "w" }, engine: "opencode" });
    expect(screen.queryByTestId(EngineBadgeTestId.Badge)).not.toBeInTheDocument();
  });
});
