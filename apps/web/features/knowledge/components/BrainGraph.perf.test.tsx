import { Profiler } from "react";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../../../test/render";
import type { BrainGraphData } from "../brainModel";
import { BrainGraph, BrainGraphTestId } from "./BrainGraph";

/** A vault-sized brain: 400 notes, ~3 links each, plus the index hub. */
function bigGraph(n = 400): BrainGraphData {
  const nodes: BrainGraphData["nodes"] = [
    { id: "index", localId: "index", sourceId: "index", label: "Index", hub: true },
  ];
  for (let i = 0; i < n; i++)
    nodes.push({ id: `vault:n${i}`, localId: `n${i}`, sourceId: "vault", label: `Note ${i}` });
  const edges: BrainGraphData["edges"] = [];
  for (let i = 0; i < n; i++)
    for (const d of [1, 7, 31]) edges.push({ from: `vault:n${i}`, to: `vault:n${(i + d) % n}` });
  return { nodes, edges };
}

let frame: ((t: number) => void) | null = null;
let now = 0;

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    frame = cb;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frame = null;
  });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => vi.unstubAllGlobals());

/** Runs `frames` display frames (16 ms apart) and returns how many React commits they caused. */
function idleCommits(frames: number): { commits: number; elements: number } {
  let commits = 0;
  render(
    <Profiler id="g" onRender={() => commits++}>
      <BrainGraph
        graph={bigGraph()}
        matchIds={null}
        onSelect={() => {}}
        selectedId={null}
        sourceColor={() => "red"}
        sourceName={(id) => id}
      />
    </Profiler>,
  );
  const mounted = commits;
  for (let i = 0; i < frames; i++) {
    now += 16;
    act(() => frame?.(now));
  }
  const svg = screen.getByTestId(BrainGraphTestId.Svg);
  return {
    commits: commits - mounted,
    elements: svg.querySelectorAll("*").length,
  };
}

describe("BrainGraph idle cost", () => {
  it("an untouched graph does not re-render on every frame", () => {
    const { commits, elements } = idleCommits(120); // ~2 s
    console.info(`[perf] 400 notes: ${elements} SVG elements, ${commits} commits in 120 frames`);
    expect(commits).toBeLessThanOrEqual(2);
  });
});
