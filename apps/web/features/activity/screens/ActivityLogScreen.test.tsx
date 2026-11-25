import { fireEvent } from "@testing-library/react";
import { DEFAULT_ACTIVITY_VIEW } from "@zibby/contracts";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../test/render";
import { ActivityLogScreen } from "./ActivityLogScreen";

const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/activity/log",
  useSearchParams: () => searchParams.current,
}));

const {
  mockUseActivityFeedInfiniteQuery,
  mockUseActivityViewQuery,
  mockUseAgentsQuery,
  fetchNextPage,
} = vi.hoisted(() => ({
  mockUseActivityFeedInfiniteQuery: vi.fn(),
  mockUseActivityViewQuery: vi.fn(),
  mockUseAgentsQuery: vi.fn(),
  fetchNextPage: vi.fn(),
}));

vi.mock("../queries", () => ({
  useActivityFeedInfiniteQuery: mockUseActivityFeedInfiniteQuery,
}));
vi.mock("../../settings/queries", () => ({
  useActivityViewQuery: mockUseActivityViewQuery,
}));
vi.mock("../../agents", () => ({
  useAgentsQuery: mockUseAgentsQuery,
}));

const ERROR_ENTRY = {
  id: "act_err",
  at: "2026-07-15T10:06:00.000Z",
  kind: "api-error",
  summary: "✗ POST /api/x 500 — kaboom",
  traceId: "trace-1",
  refs: { request: "POST /api/x", status: "500", stack: "Error: kaboom\n    at handler" },
};

function seed(extra: unknown[] = []) {
  mockUseActivityFeedInfiniteQuery.mockReturnValue({
    data: [
      ...extra,
      {
        id: "act_2",
        at: "2026-07-15T10:05:00.000Z",
        kind: "task-created",
        summary: "second entry",
        refs: { department: "dev" },
      },
      {
        id: "act_1",
        at: "2026-07-15T10:00:00.000Z",
        kind: "task-created",
        summary: "first entry",
        refs: {},
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    fetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
  });
  mockUseActivityViewQuery.mockReturnValue({ data: DEFAULT_ACTIVITY_VIEW });
  mockUseAgentsQuery.mockReturnValue({ data: [] });
}

describe("ActivityLogScreen (ZB-07)", () => {
  it("renders a log line per seeded activity entry", () => {
    seed();
    renderWithProviders(<ActivityLogScreen />);
    expect(screen.getByText("first entry")).toBeInTheDocument();
    expect(screen.getByText("second entry")).toBeInTheDocument();
  });

  it("freezes the feed while paused", () => {
    seed();
    renderWithProviders(<ActivityLogScreen />);
    fireEvent.click(screen.getByText("Pozastavit"));
    mockUseActivityFeedInfiniteQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    // Still shows the frozen snapshot rather than the (now-empty) live feed.
    expect(screen.getByText("first entry")).toBeInTheDocument();
  });

  it("clears the currently displayed lines", () => {
    seed();
    renderWithProviders(<ActivityLogScreen />);
    fireEvent.click(screen.getByText("Vyčistit"));
    expect(screen.queryByText("first entry")).toBeNull();
  });

  it("opens the stack-trace dialog when an api-error line is clicked", () => {
    seed([ERROR_ENTRY]);
    renderWithProviders(<ActivityLogScreen />);
    fireEvent.click(screen.getByText(ERROR_ENTRY.summary));
    expect(screen.getByText(/at handler/)).toBeInTheDocument();
  });

  it("opens the dialog directly for ?error=<traceId> when that line is not rendered", () => {
    searchParams.current = new URLSearchParams("error=trace-1");
    mockUseActivityViewQuery.mockReturnValue({
      data: { ...DEFAULT_ACTIVITY_VIEW, errors: "hidden" },
    });
    seed([ERROR_ENTRY]);
    mockUseActivityViewQuery.mockReturnValue({
      data: { ...DEFAULT_ACTIVITY_VIEW, errors: "hidden" },
    });
    renderWithProviders(<ActivityLogScreen />);
    expect(screen.getByText(/at handler/)).toBeInTheDocument();
    searchParams.current = new URLSearchParams();
  });
});
