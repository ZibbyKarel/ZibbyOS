import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { ChatBubble, ChatBubbleTestId } from "./ChatBubble";

describe("ChatBubble", () => {
  it("renders a right-aligned neutral bubble for you", () => {
    render(<ChatBubble author="you">Hi</ChatBubble>);
    const root = screen.getByTestId(ChatBubbleTestId.Root);
    expect(root).toHaveClass("self-end", "bg-panel-2");
    expect(root).not.toHaveClass("bg-ink");
    expect(screen.getByTestId(ChatBubbleTestId.Body)).toHaveTextContent("Hi");
    expect(screen.queryByTestId(ChatBubbleTestId.Actions)).toBeNull();
  });

  it("renders a left-aligned outlined bubble for assistant with actions", () => {
    render(
      <ChatBubble actions={<button type="button">Go</button>} author="assistant">
        Hello
      </ChatBubble>,
    );
    expect(screen.getByTestId(ChatBubbleTestId.Root)).toHaveClass("self-start", "border-line");
    expect(screen.getByTestId(ChatBubbleTestId.Actions)).toHaveTextContent("Go");
  });

  it("accepts a data-testid override and a ref", () => {
    let node: HTMLDivElement | null = null;
    render(
      <ChatBubble
        author="you"
        data-testid="custom"
        ref={(el) => {
          node = el;
        }}
      >
        x
      </ChatBubble>,
    );
    expect(screen.getByTestId("custom")).toBe(node);
  });
});
