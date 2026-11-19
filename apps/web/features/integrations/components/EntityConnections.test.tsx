import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { Integration } from "@zibby/contracts";
import { ConnectionTileTestId } from "@zibby/design-system";
import { renderWithProviders as render, screen } from "../../../test/render";
import { buildConnections } from "../connectionsModel";
import { EntityConnections } from "./EntityConnections";

const now = Date.parse("2026-11-19T00:00:00Z");
const jira = {
  id: "jira-1",
  kind: "jira",
  name: "Jira",
  enabled: true,
  status: "error",
  hasCredentials: true,
  companyId: "acme",
  config: { kind: "jira", baseUrl: "https://a.atlassian.net", email: "a@a.cz" },
} as unknown as Integration;

describe("EntityConnections", () => {
  it("renders a tile per connection and opens the wizard from the connect tile", async () => {
    const onConnect = vi.fn();
    const onOpen = vi.fn();
    render(
      <EntityConnections
        model={buildConnections([jira], [], { companyId: "acme" }, now)}
        onConnect={onConnect}
        onOpen={onOpen}
        ribbon={[]}
      />,
    );
    await userEvent.click(screen.getByTestId(ConnectionTileTestId.Root));
    expect(onOpen).toHaveBeenCalledWith(jira);
    await userEvent.click(screen.getByTestId(ConnectionTileTestId.Add));
    expect(onConnect).toHaveBeenCalled();
  });
});
