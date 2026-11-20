import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { ChatWidget } from "@zibby/contracts";
import { CHAT_WIDGET_KINDS } from "@zibby/contracts";
import { ChatWidgetCard } from "./ChatWidgetCard";

vi.mock("./RunWidgetCard", () => ({ RunWidgetCard: () => <div data-testid="run" /> }));
vi.mock("./RunsWidgetCard", () => ({ RunsWidgetCard: () => <div data-testid="runs" /> }));
vi.mock("./PrsWidgetCard", () => ({ PrsWidgetCard: () => <div data-testid="prs" /> }));
vi.mock("./IssuesWidgetCard", () => ({ IssuesWidgetCard: () => <div data-testid="issues" /> }));
vi.mock("./ApprovalsWidgetCard", () => ({
  ApprovalsWidgetCard: () => <div data-testid="approvals" />,
}));
vi.mock("./BriefingWidgetCard", () => ({
  BriefingWidgetCard: () => <div data-testid="briefing" />,
}));
vi.mock("./MentionsWidgetCard", () => ({
  MentionsWidgetCard: () => <div data-testid="mentions" />,
}));
vi.mock("./ProjectStatusWidgetCard", () => ({
  ProjectStatusWidgetCard: () => <div data-testid="project-status" />,
}));
vi.mock("./PrRepliesWidgetCard", () => ({
  PrRepliesWidgetCard: () => <div data-testid="pr-replies" />,
}));
vi.mock("./TodoWidgetCard", () => ({ TodoWidgetCard: () => <div data-testid="todo" /> }));
vi.mock("./CiWidgetCard", () => ({
  CiWidgetCard: (p: { onPrompt?: (t: string) => void }) => (
    <button data-testid="ci" onClick={() => p.onPrompt?.("hi")} type="button" />
  ),
}));

const widgetFor = (kind: (typeof CHAT_WIDGET_KINDS)[number]): ChatWidget =>
  kind === "run" ? { kind, runRef: "r1" } : ({ kind } as ChatWidget);

describe("ChatWidgetCard", () => {
  it.each(CHAT_WIDGET_KINDS)("dispatches kind %s", (kind) => {
    render(<ChatWidgetCard widget={widgetFor(kind)} />);
    expect(screen.getByTestId(kind)).toBeInTheDocument();
  });

  it("forwards onPrompt to the ci card", async () => {
    const onPrompt = vi.fn();
    render(<ChatWidgetCard onPrompt={onPrompt} widget={{ kind: "ci" }} />);
    await userEvent.click(screen.getByTestId("ci"));
    expect(onPrompt).toHaveBeenCalledWith("hi");
  });
});
