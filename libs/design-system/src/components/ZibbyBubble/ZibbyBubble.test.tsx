import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyBubble, ZibbyBubbleTestId } from "./ZibbyBubble";

describe("ZibbyBubble", () => {
  it("renders a right-aligned me bubble with attachments and meta", () => {
    render(
      <ZibbyBubble attachments={<span>chip</span>} author="me" meta="přepis · 17:33">
        Ahoj
      </ZibbyBubble>,
    );
    const root = screen.getByTestId(ZibbyBubbleTestId.Root);
    expect(root).toHaveClass("self-end");
    expect(root).toHaveTextContent("Ahoj");
    expect(root).not.toHaveAttribute("role");
    expect(screen.getByTestId(ZibbyBubbleTestId.Attachments)).toHaveTextContent("chip");
    expect(screen.getByTestId(ZibbyBubbleTestId.Meta)).toHaveTextContent("přepis · 17:33");
  });

  it("becomes an accessible button with onEdit (click, Enter, Space)", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <ZibbyBubble author="me" editLabel="Opravit" onEdit={onEdit}>
        Text
      </ZibbyBubble>,
    );
    const root = screen.getByTestId(ZibbyBubbleTestId.Root);
    expect(root).toHaveRole("button");
    expect(root).toHaveAccessibleName("Opravit");
    await user.tab();
    expect(root).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.click(root);
    expect(onEdit).toHaveBeenCalledTimes(3);
  });

  it("renders the zibby layout: avatar, content, caret, cards, actions", () => {
    render(
      <ZibbyBubble
        streaming
        actions={<button type="button">Speak</button>}
        author="zibby"
        avatar={<i>o</i>}
        cards={<div>card</div>}
      >
        Odpověď
      </ZibbyBubble>,
    );
    expect(screen.getByTestId(ZibbyBubbleTestId.Root)).toHaveClass("self-start");
    expect(screen.getByTestId(ZibbyBubbleTestId.Root)).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId(ZibbyBubbleTestId.Avatar)).toHaveTextContent("o");
    expect(screen.getByTestId(ZibbyBubbleTestId.Content)).toHaveTextContent("Odpověď");
    expect(screen.getByTestId(ZibbyBubbleTestId.Caret)).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId(ZibbyBubbleTestId.Cards)).toHaveTextContent("card");
    expect(screen.getByTestId(ZibbyBubbleTestId.Actions)).toHaveTextContent("Speak");
  });

  it("omits caret/cards/actions by default", () => {
    render(<ZibbyBubble author="zibby">x</ZibbyBubble>);
    expect(screen.queryByTestId(ZibbyBubbleTestId.Caret)).toBeNull();
    expect(screen.queryByTestId(ZibbyBubbleTestId.Cards)).toBeNull();
    expect(screen.queryByTestId(ZibbyBubbleTestId.Actions)).toBeNull();
  });

  it("does not edit when text is being selected", () => {
    const onEdit = vi.fn();
    render(
      <ZibbyBubble author="me" onEdit={onEdit}>
        Text
      </ZibbyBubble>,
    );
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Te" } as Selection);
    fireEvent.click(screen.getByTestId(ZibbyBubbleTestId.Root));
    expect(onEdit).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
