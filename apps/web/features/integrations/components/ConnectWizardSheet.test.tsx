import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render, screen } from "../../../test/render";
import { ConnectWizardSheet, ConnectWizardTestId } from "./ConnectWizardSheet";
import { IntegrationFormTestId } from "./IntegrationFormFields";

const create = vi.hoisted(() => vi.fn());
vi.mock("../mutations", () => ({
  useCreateIntegrationMutation: () => ({ mutateAsync: create, isPending: false }),
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
        owner={{ companyId: "acme" }}
        ownerName="Acme"
      />,
    );
    expect(screen.getByTestId(ConnectWizardTestId.Root)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(`${ConnectWizardTestId.Service}-github`));
    expect(screen.getByTestId(ConnectWizardTestId.Back)).toBeInTheDocument();
  });

  it("creates a personal account (no companyId) with a personal- default id", async () => {
    render(<ConnectWizardSheet onClose={vi.fn()} onOpenIntegration={vi.fn()} owner={{}} />);
    await userEvent.click(screen.getByTestId(`${ConnectWizardTestId.Service}-github`));
    await userEvent.type(screen.getByTestId(IntegrationFormTestId.GithubUsername), "octocat");
    await userEvent.click(screen.getByTestId(ConnectWizardTestId.Next));
    const body = create.mock.calls[0]?.[0].body;
    expect(body).toMatchObject({ id: "personal-github", kind: "github" });
    expect(body).not.toHaveProperty("companyId");
  });
});
