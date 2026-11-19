import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../../../test/render";
import { ChatWidgetFrameTestId } from "./ChatWidgetFrame";
import { TodoWidgetCard, TodoWidgetCardTestId } from "./TodoWidgetCard";

const { todos, remove, create } = vi.hoisted(() => ({
  todos: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
}));
vi.mock("../../todo/queries", () => ({ getTodoQueryKey: () => ["todo"], useTodoQuery: todos }));
vi.mock("../../todo/mutations", () => ({
  useDeleteTodoMutation: () => ({ mutate: remove }),
}));
vi.mock("../../tasks/mutations", () => ({
  useCreateTaskMutation: () => ({ mutate: create, isPending: false }),
}));
vi.mock("./RunWidgetCard", () => ({ RunWidgetCard: () => <div data-testid="run-card" /> }));

const item = { id: "t1", text: "Fix the login bug", createdAt: new Date().toISOString() };
const ready = () =>
  todos.mockReturnValue({ data: { items: [item] }, isPending: false, isError: false });

describe("TodoWidgetCard", () => {
  it("shows the empty line when there are no notes", () => {
    todos.mockReturnValue({ data: { items: [] }, isPending: false, isError: false });
    render(<TodoWidgetCard widget={{ kind: "todo" }} />);
    expect(screen.getByTestId(ChatWidgetFrameTestId.Empty)).toHaveTextContent(
      "Žádné poznámky v TODO",
    );
  });

  it("ticking a note deletes it", async () => {
    ready();
    render(<TodoWidgetCard widget={{ kind: "todo" }} />);
    await userEvent.click(screen.getByTestId(`${TodoWidgetCardTestId.Done}-t1`));
    expect(remove).toHaveBeenCalledWith({ params: { id: "t1" } });
  });

  it("play creates the task from the note and shows the run card", async () => {
    ready();
    create.mockImplementation((_vars, opts) =>
      opts.onSuccess({ body: { outcome: "dispatched", runRef: "r1", task: { id: "task1" } } }),
    );
    render(<TodoWidgetCard widget={{ kind: "todo" }} />);
    await userEvent.click(screen.getByTestId(`${TodoWidgetCardTestId.Play}-t1`));
    expect(create.mock.calls[0]?.[0]).toEqual({
      body: { title: "Fix the login bug", text: "Fix the login bug", todoId: "t1" },
    });
    expect(screen.getByTestId("run-card")).toBeInTheDocument();
  });
});
