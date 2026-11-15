import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import type { ChannelItem } from "@zibby/contracts";
import { MentionsWidgetCard, MentionsWidgetCardTestId, openMentions } from "./MentionsWidgetCard";
import { ChatWidgetFrameTestId } from "./ChatWidgetFrame";

const item = (id: string, state: ChannelItem["state"]): ChannelItem =>
  ({
    id,
    integrationId: "i",
    kind: "slack",
    externalRef: {},
    raw: null,
    from: "Eva",
    receivedAt: "2026-11-15T08:00:00.000Z",
    text: `Zpráva ${id}`,
    state,
  }) as ChannelItem;

const { channels } = vi.hoisted(() => ({ channels: vi.fn() }));
vi.mock("../../integrations/queries", () => ({ useChannelItemsQuery: channels }));

describe("MentionsWidgetCard", () => {
  it("drops handled and ignored items", () => {
    expect(
      openMentions([item("a", "new"), item("b", "handled"), item("c", "ignored")]),
    ).toHaveLength(1);
  });

  it("renders source badge, sender and links to the channel inbox", () => {
    channels.mockReturnValue({ data: [item("a", "new")], isPending: false, isError: false });
    render(<MentionsWidgetCard widget={{ kind: "mentions" }} />);
    expect(screen.getByTestId(`${MentionsWidgetCardTestId.Source}-a`)).toHaveTextContent("Slack");
    expect(screen.getByTestId(`${ChatWidgetFrameTestId.RowStatus}-a`)).toHaveTextContent("Eva");
    expect(screen.getByTestId(`${ChatWidgetFrameTestId.RowLink}-a`)).toHaveAttribute(
      "href",
      "/activity/channels",
    );
  });
});
