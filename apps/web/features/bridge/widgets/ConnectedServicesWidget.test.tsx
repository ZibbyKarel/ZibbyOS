import { IconTestId, ReadingItemTestId } from "@zibby/design-system";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../../../test/render";
import type { BridgeWidget } from "../grid/layout";
import { ConnectedServicesListTestId as ConnectedServicesWidgetTestId } from "../../connected-services/components/ConnectedServicesList";
import {
  ConnectedServiceDeleteDialog,
  ConnectedServiceDeleteDialogTestId,
} from "../../connected-services/components/ConnectedServiceDeleteDialog";
import { ConnectedServiceDialogTestId } from "../../connected-services/components/ConnectedServiceDialog";
import {
  ConnectedServicesWidget,
  ConnectedServicesWidgetTestId as WidgetTestId,
} from "./ConnectedServicesWidget";
import type { BridgeWidgetProps } from "./registry";

const connect = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
vi.mock("../../connected-services/queries", () => ({
  useConnectedServicesQuery: () => ({
    isPending: false,
    isError: false,
    data: [
      {
        id: "claude",
        name: "Claude",
        landingUrl: "https://claude.ai",
        loginUrl: "https://claude.ai/login",
        iconUrl: "https://claude.ai/icon.png",
        profile: "claude",
        status: "connected",
      },
      {
        id: "figma",
        name: "Figma",
        landingUrl: "https://figma.com",
        loginUrl: "https://figma.com/login",
        profile: "figma",
        status: "disconnected",
      },
    ],
  }),
}));
vi.mock("../../connected-services/mutations", () => ({
  useConnectServiceMutation: () => ({ mutate: connect, isPending: false }),
  useCreateConnectedServiceMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateConnectedServiceMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteConnectedServiceMutation: () => ({ mutate: del, isPending: false }),
}));

const widget: BridgeWidget = { id: "w-c", type: "connectedServices", x: 0, y: 0, w: 4, h: 6 };
const onCountChange = vi.fn();
const props: BridgeWidgetProps = {
  widget,
  adding: false,
  onEmptyChange: vi.fn(),
  onCountChange,
  selection: null,
  onOpen: vi.fn(),
  epicClosed: {},
  onEpicToggle: vi.fn(),
};

describe("ConnectedServicesWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row per service with its status and reports the disconnected count as you", () => {
    renderWithProviders(<ConnectedServicesWidget {...props} />);
    expect(screen.getAllByTestId(ReadingItemTestId.Text).map((r) => r.textContent)).toEqual([
      "Claude",
      "Figma",
    ]);
    // status is a green check / red cross, named for assistive tech — no "connected" word
    const marks = screen
      .getAllByTestId(ConnectedServicesWidgetTestId.Status)
      .map((r) => within(r).getByTestId(IconTestId.Root));
    expect(marks.map((m) => m.getAttribute("data-icon"))).toEqual(["check", "x"]);
    expect(marks.map((m) => m.getAttribute("aria-label"))).toEqual(["Připojeno", "Odpojeno"]);
    expect(
      screen.getAllByTestId(ConnectedServicesWidgetTestId.Status).map((r) => r.textContent),
    ).toEqual(["", ""]);
    expect(onCountChange).toHaveBeenLastCalledWith(expect.objectContaining({ count: 2, you: 1 }));
  });

  it("Connect on a disconnected row calls the mutation with its id", () => {
    renderWithProviders(<ConnectedServicesWidget {...props} />);
    fireEvent.click(screen.getByTestId(ConnectedServicesWidgetTestId.Connect));
    expect(connect).toHaveBeenCalledWith({ params: { id: "figma" } });
  });

  it("a connected row opens its landing url in a new tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderWithProviders(<ConnectedServicesWidget {...props} />);
    fireEvent.click(screen.getByTestId(ReadingItemTestId.Open));
    expect(open).toHaveBeenCalledWith("https://claude.ai", "_blank", "noopener,noreferrer");
  });

  it("shows the icon URL or the favicon, and the plug when the image fails", () => {
    renderWithProviders(<ConnectedServicesWidget {...props} />);
    const icons = screen.getAllByTestId(ConnectedServicesWidgetTestId.Icon);
    expect(icons.map((i) => i.getAttribute("src"))).toEqual([
      "https://claude.ai/icon.png",
      "https://figma.com/favicon.ico",
    ]);
    expect(screen.queryByTestId(ConnectedServicesWidgetTestId.Edit)).toBeNull();
    fireEvent.error(icons[1]!);
    expect(screen.getAllByTestId(ConnectedServicesWidgetTestId.Icon)).toHaveLength(1);
    expect(screen.getAllByTestId(IconTestId.Root).some((i) => i.dataset.icon === "plug")).toBe(
      true,
    );
  });

  it("the add button opens the add-service dialog", () => {
    renderWithProviders(<ConnectedServicesWidget {...props} />);
    expect(screen.queryByTestId(ConnectedServiceDialogTestId.Name)).toBeNull();
    fireEvent.click(screen.getByTestId(WidgetTestId.Add));
    expect(screen.getByTestId(ConnectedServiceDialogTestId.Name)).toBeTruthy();
    expect(screen.getByTestId(ConnectedServiceDialogTestId.AuthCookies)).toBeTruthy();
  });

  it("delete asks for confirmation and says the profile stays", () => {
    renderWithProviders(
      <ConnectedServiceDeleteDialog
        onClose={vi.fn()}
        service={{
          id: "figma",
          name: "Figma",
          landingUrl: "https://figma.com",
          loginUrl: "https://figma.com/login",
          profile: "figma",
          authCookies: [],
          status: "disconnected",
        }}
      />,
    );
    expect(screen.getByRole("dialog").textContent).toContain("figma");
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(ConnectedServiceDeleteDialogTestId.Confirm));
    expect(del.mock.calls[0]?.[0]).toEqual({ params: { id: "figma" } });
  });
});
