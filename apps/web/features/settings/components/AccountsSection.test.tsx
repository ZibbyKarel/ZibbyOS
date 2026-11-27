import { ReadingItemTestId } from "@zibby/design-system";
import type { Integration } from "@zibby/contracts";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render, screen } from "../../../test/render";
import { AccountsSection, AccountsSectionTestId } from "./AccountsSection";
import { AccountCardsTestId } from "../../integrations/components/AccountCards";
import { ConnectWizardTestId } from "../../integrations/components/ConnectWizardSheet";
import { ConnectedServiceDialogTestId } from "../../connected-services/components/ConnectedServiceDialog";
import { ConnectedServicesListTestId } from "../../connected-services/components/ConnectedServicesList";

const idle = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const personal = vi.hoisted(() => ({ data: [] as Integration[] }));

vi.mock("../../integrations", () => ({
  usePersonalIntegrationsQuery: () => personal,
  useIntegrationsQuery: () => ({ data: [] }),
  useCreateIntegrationMutation: () => idle,
  useSetCredentialsMutation: () => idle,
  useTestIntegrationMutation: () => idle,
  useUpdateIntegrationMutation: () => idle,
}));
vi.mock("../../connected-services/queries", () => ({
  useConnectedServicesQuery: () => ({
    isPending: false,
    isError: false,
    data: [
      {
        id: "kdp",
        name: "KDP",
        landingUrl: "https://kdp.amazon.com",
        loginUrl: "https://kdp.amazon.com/login",
        profile: "kdp",
        status: "connected",
      },
    ],
  }),
}));
vi.mock("../../connected-services/mutations", () => ({
  useConnectServiceMutation: () => idle,
  useCreateConnectedServiceMutation: () => idle,
  useUpdateConnectedServiceMutation: () => idle,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const gmail = {
  id: "my-gmail",
  kind: "email",
  name: "My Gmail",
  enabled: true,
  status: "connected",
  hasCredentials: true,
  config: { kind: "email", imapHost: "i", imapPort: 993, smtpHost: "s", smtpPort: 465, user: "me" },
} as Integration;

describe("AccountsSection", () => {
  it("lists the personal accounts and the connected services", () => {
    personal.data = [gmail];
    render(<AccountsSection />);
    expect(screen.getByText("My Gmail")).toBeInTheDocument();
    expect(screen.queryByTestId(AccountCardsTestId.Empty)).not.toBeInTheDocument();
    expect(screen.getByTestId(ReadingItemTestId.Text)).toHaveTextContent("KDP");
  });

  it("shows the empty state and opens the personal connect wizard", async () => {
    personal.data = [];
    render(<AccountsSection />);
    expect(screen.getByTestId(AccountCardsTestId.Empty)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(AccountsSectionTestId.Connect));
    expect(screen.getByTestId(ConnectWizardTestId.Root)).toHaveTextContent(
      "Připojuji jeden z tvých osobních účtů.",
    );
  });

  it("edits a service in a prefilled dialog", async () => {
    render(<AccountsSection />);
    await userEvent.click(screen.getByTestId(ConnectedServicesListTestId.Edit));
    expect(screen.getByTestId(ConnectedServiceDialogTestId.Name)).toHaveValue("KDP");
    await userEvent.clear(screen.getByTestId(ConnectedServiceDialogTestId.Name));
    await userEvent.type(screen.getByTestId(ConnectedServiceDialogTestId.Name), "Kindle");
    await userEvent.click(screen.getByTestId(ConnectedServiceDialogTestId.Submit));
    expect(idle.mutate).toHaveBeenCalledWith(
      {
        params: { id: "kdp" },
        body: {
          name: "Kindle",
          loginUrl: "https://kdp.amazon.com/login",
          iconUrl: null,
          authCookies: [],
        },
      },
      expect.anything(),
    );
  });

  it("adds a service from an empty dialog", async () => {
    render(<AccountsSection />);
    await userEvent.click(screen.getByTestId(AccountsSectionTestId.AddService));
    expect(screen.getByTestId(ConnectedServiceDialogTestId.Name)).toHaveValue("");
  });
});
