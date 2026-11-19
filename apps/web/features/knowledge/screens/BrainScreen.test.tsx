import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import cs from "../../../i18n/messages/cs.json";
import { AppearanceProvider } from "../../../state/appearance";
import type { BrainData } from "../hooks/useBrainData";
import { TreeDockTestId } from "../components/TreeDock";
import { BrainScreen, BrainScreenTestId } from "./BrainScreen";

const messages = cs;

const brain: BrainData = {
  graph: {
    nodes: [
      { id: "index", localId: "index", sourceId: "vault", label: "Index", hub: true },
      { id: "vault:log", localId: "log", sourceId: "vault", label: "Log", tier: "memory" },
    ],
    edges: [{ from: "index", to: "vault:log" }],
  },
  sources: [
    { id: "vault", name: "ZibbyOS", kind: "vault", state: "ready", notes: 1, retry: vi.fn() },
    { id: "t1", name: "Tým", kind: "kb", state: "failed", notes: 0, retry: vi.fn() },
  ],
  openQuestions: [{ teamId: "t1", teamName: "Tým", text: "Why?", noteId: "n", noteTitle: "N" }],
  isLoading: false,
  isEmpty: false,
} as unknown as BrainData;

let current = brain;
vi.mock("../hooks/useBrainData", () => ({ useBrainData: () => current }));
vi.mock("../hooks/useSyncAllSources", () => ({
  useSyncAllSources: () => ({ state: {}, running: false, runAll: vi.fn(), retry: vi.fn() }),
}));
vi.mock("../queries", () => ({ useMemorySearchQuery: () => ({ data: undefined }) }));
vi.mock("../components/BrainGraph", () => ({ BrainGraph: () => <div /> }));
vi.mock("../components/NotePane", () => ({ NotePane: () => <div /> }));

function renderScreen(ui: ReactElement) {
  return render(
    <AppearanceProvider>
      <NextIntlClientProvider locale="cs" messages={messages}>
        <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
      </NextIntlClientProvider>
    </AppearanceProvider>,
  );
}

describe("BrainScreen", () => {
  it("renders the three zones, and the failed-source banner", () => {
    current = brain;
    renderScreen(<BrainScreen />);
    expect(screen.getByTestId(BrainScreenTestId.GraphZone)).toBeInTheDocument();
    expect(screen.getByTestId(BrainScreenTestId.TreeZone)).toBeInTheDocument();
    expect(screen.getByTestId(BrainScreenTestId.NoteZone)).toBeInTheDocument();
    expect(screen.getByTestId(BrainScreenTestId.FailedBanner)).toHaveTextContent("Tým");
  });

  it("keeps the tree collapsed to a rail and opens it on click", async () => {
    current = brain;
    renderScreen(<BrainScreen />);
    expect(screen.queryByTestId(TreeDockTestId.Close)).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId(TreeDockTestId.Rail));
    expect(screen.getByTestId(TreeDockTestId.Close)).toBeInTheDocument();
  });

  it("shows the empty state when the brain has no notes", () => {
    current = { ...brain, isEmpty: true } as BrainData;
    renderScreen(<BrainScreen />);
    expect(screen.getByTestId(BrainScreenTestId.Empty)).toBeInTheDocument();
  });
});
