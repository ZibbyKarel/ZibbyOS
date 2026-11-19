import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Agent, PhaseLoop } from "@zibby/contracts";
import { renderWithProviders as render, screen } from "../../../../test/render";
import { LoopFields } from "./LoopFields";
import { Palette, PaletteTestId } from "./Palette";
import { InspectorTestId } from "./Inspector";

const AGENTS: Agent[] = [
  { id: "writer", name: "Writer", glyph: "edit", instructions: "write" },
  { id: "tester", name: "Tester", glyph: "flask", instructions: "test" },
];

describe("Palette", () => {
  const setup = (onAdd = vi.fn()) => {
    render(
      <Palette
        open
        agents={AGENTS}
        onAdd={onAdd}
        onCancelInsert={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    return onAdd;
  };

  it("lists the agents and filters them by the search text", async () => {
    setup();
    expect(screen.getByTestId(`${PaletteTestId.Agent}-writer`)).toBeInTheDocument();
    await userEvent.type(screen.getByTestId(PaletteTestId.Search), "test");
    expect(screen.queryByTestId(`${PaletteTestId.Agent}-writer`)).toBeNull();
    expect(screen.getByTestId(`${PaletteTestId.Agent}-tester`)).toBeInTheDocument();
  });

  it("clicking an agent adds it", async () => {
    const onAdd = setup();
    await userEvent.click(screen.getByTestId(`${PaletteTestId.Agent}-writer`));
    expect(onAdd).toHaveBeenCalledWith({ kind: "agent", id: "writer" });
  });

  it("the tool step adds a tool phase", async () => {
    const onAdd = setup();
    await userEvent.click(screen.getByTestId(PaletteTestId.Tool));
    expect(onAdd).toHaveBeenCalledWith({ kind: "step", type: "tool" });
  });
});

describe("LoopFields", () => {
  const LOOP: PhaseLoop = { to: "a", maxRetries: 2, escalate: false, then: "park" };
  const setup = (loop = LOOP) => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    render(
      <LoopFields
        loop={loop}
        onChange={onChange}
        onRemove={onRemove}
        retryTargets={[{ id: "a", label: "A" }]}
        thenTargets={[{ id: "a", label: "A" }]}
      />,
    );
    return { onChange, onRemove };
  };

  it("shows one ladder rung per retry (attempts 2..n+1)", () => {
    setup();
    expect(screen.getByTestId("loop-rung-1")).toBeInTheDocument();
    expect(screen.getByTestId("loop-rung-2")).toBeInTheDocument();
    expect(screen.queryByTestId("loop-rung-3")).toBeNull();
  });

  it("the retries stepper changes maxRetries", async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Více opakování" }));
    expect(onChange).toHaveBeenCalledWith({ ...LOOP, maxRetries: 3 });
  });
});

describe("Inspector resize handle", () => {
  it("is a separator carrying the width bounds", async () => {
    const { Inspector } = await import("./Inspector");
    const onWidthChange = vi.fn();
    render(
      <Inspector
        editing
        agents={AGENTS}
        departments={[]}
        draft={{
          name: "W",
          desc: "",
          department: "",
          complexity: "standard",
          maxCostUsd: null,
          warnAtPct: 70,
          project: "",
          requiresWeb: false,
          advisor: undefined,
          instructions: "",
          outputs: [],
        }}
        graph={{ nodes: [], flow: [], rework: [] }}
        onClose={vi.fn()}
        onDraftChange={vi.fn()}
        onWidthChange={onWidthChange}
        problems={[]}
        selectedId={null}
        setGraph={vi.fn()}
        width={360}
        workflow={{
          id: "w",
          name: "W",
          lastRun: "",
          lastState: "done",
          desc: "",
          file: "f",
          outputs: [],
          phases: [],
        }}
        workflows={[]}
      />,
    );
    const sep = screen.getByTestId(InspectorTestId.Resize);
    expect(sep).toHaveAttribute("role", "separator");
    fireEvent.keyDown(sep, { key: "ArrowLeft" });
    expect(onWidthChange).toHaveBeenCalledWith(384);
    expect(screen.getByTestId(InspectorTestId.Settings)).toBeInTheDocument();
  });
});
