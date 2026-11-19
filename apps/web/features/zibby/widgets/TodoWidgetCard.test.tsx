import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../../../test/render";
import { ChatWidgetFrameTestId } from "./ChatWidgetFrame";
import { TodoWidgetCard, TodoWidgetCardTestId } from "./TodoWidgetCard";

const { todos, setDone, create } = vi.hoisted(() => ({
  todos: vi.fn(),
  setDone: vi.fn(),
  create: vi.fn(),
}));
vi.mock("../../todo/queries", () => ({ useProjectTodoQuery: todos }));
vi.mock("../../todo/mutations", () => ({
  useSetProjectTodoDoneMutation: () => ({ mutate: setDone }),
}));
vi.mock("../../projects/queries", () => ({
  useProjectsQuery: () => ({ data: [{ id: "acme", name: "Acme" }] }),
}));
vi.mock("../../tasks/mutations", () => ({
  useCreateTaskMutation: () => ({ mutate: create, isPending: false }),
}));
vi.mock("./RunWidgetCard", () => ({ RunWidgetCard: () => <div data-testid="run-card" /> }));

const items = [
  { number: 1, text: "Already done", done: true },
  { number: 2, text: "Fix the login bug", done: false },
];
const ready = () => todos.mockReturnValue({ data: { items }, isPending: false, isError: false });
const widget = { kind: "todo" as const, projectId: "acme" };

describe("TodoWidgetCard", () => {
  it("shows the empty line when nothing is open", () => {
    todos.mockReturnValue({ data: { items: [] }, isPending: false, isError: false });
    render(<TodoWidgetCard widget={widget} />);
    expect(screen.getByTestId(ChatWidgetFrameTestId.Empty)).toHaveTextContent(
      "Žádné otevřené položky",
    );
  });

  it("lists only open items and ticking one marks it done in the project file", async () => {
    ready();
    render(<TodoWidgetCard widget={widget} />);
    expect(screen.queryByTestId(`${TodoWidgetCardTestId.Done}-1`)).toBeNull();
    await userEvent.click(screen.getByTestId(`${TodoWidgetCardTestId.Done}-2`));
    expect(setDone).toHaveBeenCalledWith({
      params: { projectId: "acme", number: 2 },
      body: { done: true },
    });
  });

  it("play creates the task from the item and shows the run card", async () => {
    ready();
    create.mockImplementation((_vars, opts) =>
      opts.onSuccess({ body: { outcome: "dispatched", runRef: "r1", task: { id: "task1" } } }),
    );
    render(<TodoWidgetCard widget={widget} />);
    await userEvent.click(screen.getByTestId(`${TodoWidgetCardTestId.Play}-2`));
    expect(create.mock.calls[0]?.[0]).toEqual({
      body: { title: "Fix the login bug", text: "Fix the login bug" },
    });
    expect(screen.getByTestId("run-card")).toBeInTheDocument();
  });

  it("without a project it renders no list, only the project select", () => {
    todos.mockReturnValue({ data: undefined, isPending: false, isError: false });
    render(<TodoWidgetCard widget={{ kind: "todo" }} />);
    expect(screen.queryByTestId(TodoWidgetCardTestId.Root)).toBeNull();
    expect(screen.getByText("Projekt")).toBeInTheDocument();
  });
});
