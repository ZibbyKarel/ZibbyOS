import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render, screen } from "../../../test/render";
import { ConnectWizardSheet, ConnectWizardTestId } from "./ConnectWizardSheet";

vi.mock("../mutations", () => ({
  useCreateIntegrationMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetCredentialsMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTestIntegrationMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../queries", () => ({ useIntegrationsQuery: () => ({ data: [] }) }));

describe("ConnectWizardSheet", () => {
  it("starts on the service grid and moves to the connect form for the picked service", async () => {
    render(
      <ConnectWizardSheet
        onClose={vi.fn()}
        onOpenIntegration={vi.fn()}
        owner={{ projectId: "cms4" }}
        ownerName="cms4"
      />,
    );
    expect(screen.getByTestId(ConnectWizardTestId.Root)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(`${ConnectWizardTestId.Service}-github`));
    expect(screen.getByTestId(ConnectWizardTestId.Back)).toBeInTheDocument();
  });
});
