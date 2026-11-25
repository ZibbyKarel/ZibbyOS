import userEvent from "@testing-library/user-event";
import type { Integration } from "@zibby/contracts";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../../../test/render";
import {
  CompanyIntegrationsPanel,
  CompanyIntegrationsPanelTestId as TestId,
} from "./CompanyIntegrationsPanel";
import { ConnectWizardTestId } from "../../integrations/components/ConnectWizardSheet";
import { AccountCardsTestId } from "../../integrations/components/AccountCards";

const { hooks } = vi.hoisted(() => ({
  hooks: {
    list: { data: [] as Integration[] },
    create: { mutate: vi.fn(), isPending: false },
  },
}));
const idle = { mutate: vi.fn(), isPending: false };

vi.mock("../../integrations", () => ({
  useCompanyIntegrationsQuery: () => hooks.list,
  useIntegrationsQuery: () => hooks.list,
  useCreateIntegrationMutation: () => hooks.create,
  useSetCredentialsMutation: () => idle,
  useTestIntegrationMutation: () => idle,
  useUpdateIntegrationMutation: () => idle,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("CompanyIntegrationsPanel", () => {
  it("shows the empty state, then opens the connect wizard owned by the company", async () => {
    render(<CompanyIntegrationsPanel companyId="shoptet" ownerName="Shoptet" projectCount={2} />);
    expect(screen.getByTestId(AccountCardsTestId.Empty)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId(TestId.Add));
    expect(screen.getByTestId(ConnectWizardTestId.Root)).toBeInTheDocument();
  });
});
