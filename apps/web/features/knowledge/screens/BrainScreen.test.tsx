import type { ReactElement } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import cs from "../../../i18n/messages/cs.json";
import { AppearanceProvider } from "../../../state/appearance";
import type { BrainData } from "../hooks/useBrainData";
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
  it("renders the three zones, the failed-source banner and the pending count", () => {
    current = brain;
    renderScreen(<BrainScreen />);
    expect(screen.getByTestId(BrainScreenTestId.GraphZone)).toBeInTheDocument();
    expect(screen.getByTestId(BrainScreenTestId.TreeZone)).toBeInTheDocument();
    expect(screen.getByTestId(BrainScreenTestId.NoteZone)).toBeInTheDocument();
    expect(screen.getByTestId(BrainScreenTestId.FailedBanner)).toHaveTextContent("Tým");
    expect(screen.getByText("1 věcí čeká na tebe")).toBeInTheDocument();
  });

  it("resizes the tree zone from the keyboard splitter", async () => {
    current = brain;
    renderScreen(<BrainScreen />);
    const zone = screen.getByTestId(BrainScreenTestId.TreeZone);
    const before = zone.className + zone.getAttribute("style");
    const splitter = within(zone.parentElement as HTMLElement).getAllByRole(
      "separator",
    )[0] as HTMLElement;
    splitter.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(zone.className + zone.getAttribute("style")).not.toBe(before);
  });

  it("shows the empty state when the brain has no notes", () => {
    current = { ...brain, isEmpty: true } as BrainData;
    renderScreen(<BrainScreen />);
    expect(screen.getByTestId(BrainScreenTestId.Empty)).toBeInTheDocument();
  });
});
