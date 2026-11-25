import { renderWithProviders as render, screen } from "../../test/render";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Integration } from "@zibby/contracts";
import { BreadcrumbTestId } from "@zibby/design-system";
import { DetailScreen, IntegrationDetailScreenTestId } from "./DetailScreen";
import { IntegrationFormTestId } from "./components/IntegrationFormFields";
import { TokenExpiryLabelTestId } from "./components/TokenExpiryLabel";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
vi.mock("../companies", () => ({
  useCompaniesQuery: () => ({ data: [{ id: "acme", name: "Acme" }] }),
}));

const INTEGRATION: Integration = {
  id: "team-slack",
  kind: "slack",
  companyId: "acme",
  name: "Team Slack",
  enabled: true,
  status: "connected",
  hasCredentials: true,
  config: { kind: "slack", channels: ["C1"] },
};

const { hooks } = vi.hoisted(() => ({
  hooks: {
    integration: {
      data: undefined as unknown,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    },
    update: vi.fn(),
    del: vi.fn(),
    setCredentials: vi.fn(),
    test: vi.fn(),
  },
}));

vi.mock("./queries", () => ({
  useIntegrationQuery: () => hooks.integration,
}));
vi.mock("./mutations", () => ({
  useUpdateIntegrationMutation: () => ({ mutate: hooks.update, isPending: false }),
  useDeleteIntegrationMutation: () => ({ mutate: hooks.del, isPending: false }),
  useSetCredentialsMutation: () => ({ mutate: hooks.setCredentials, isPending: false }),
  useTestIntegrationMutation: () => ({ mutate: hooks.test, isPending: false }),
}));

describe("integrations DetailScreen (N4h grammar — closes the series)", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    hooks.update.mockClear();
    hooks.del.mockClear();
    hooks.setCredentials.mockClear();
    hooks.test.mockClear();
    hooks.integration = { data: INTEGRATION, isPending: false, isError: false, refetch: vi.fn() };
  });

  it("shows the GitHub token expiry under the title", () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-12T10:00:00Z"), toFake: ["Date"] });
    hooks.integration = {
      ...hooks.integration,
      data: {
        ...INTEGRATION,
        kind: "github",
        config: { kind: "github", streams: ["issues"], username: "octocat" },
        tokenExpiresAt: "2026-11-15T10:00:00.000Z",
      },
    };
    render(<DetailScreen integrationId="team-slack" />);
    expect(screen.getByTestId(TokenExpiryLabelTestId.Root)).toHaveTextContent("vyprší za 3 dny");
    vi.useRealTimers();
  });

  it("locks the kind and shows top-right actions by accessible name", () => {
    render(<DetailScreen integrationId="team-slack" />);
    expect(screen.getByRole("button", { name: "Uložit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Smazat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test spojení" })).toBeInTheDocument();
    expect(screen.getByTestId(IntegrationFormTestId.Kind).tagName).not.toBe("INPUT");
    expect(screen.getByTestId(IntegrationFormTestId.Kind)).toHaveTextContent("slack");
  });

  it("the breadcrumb back link returns to the owner: the company's tab, or settings for a personal account", () => {
    const { unmount } = render(<DetailScreen integrationId="team-slack" />);
    expect(screen.getByTestId(`${BreadcrumbTestId.Item}-0`)).toHaveAttribute(
      "href",
      "/companies/acme?tab=integrations",
    );
    unmount();
    hooks.integration = {
      ...hooks.integration,
      data: { ...INTEGRATION, companyId: undefined },
    };
    render(<DetailScreen integrationId="team-slack" />);
    expect(screen.getByTestId(`${BreadcrumbTestId.Item}-0`)).toHaveAttribute(
      "href",
      "/system/settings/access#accounts",
    );
    expect(screen.getAllByTestId("dropdown-trigger")[0]).toHaveTextContent("Osobní (ty)");
  });

  it("moving the account to personal PATCHes companyId: null and follows it to its new route", async () => {
    hooks.update.mockImplementation((_vars, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    );
    render(<DetailScreen integrationId="team-slack" />);
    await userEvent.click(screen.getAllByTestId("dropdown-trigger")[0]!);
    await userEvent.click(screen.getByText("Osobní (ty)"));
    expect(hooks.update).toHaveBeenCalledWith(
      { params: { id: "team-slack" }, body: { companyId: null } },
      expect.anything(),
    );
    expect(replace).toHaveBeenCalledWith("/system/settings/accounts/team-slack");
  });

  it("Save patches the config; a fresh secret rides the SEPARATE credentials mutation", async () => {
    hooks.update.mockImplementation((_vars, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    );
    render(<DetailScreen integrationId="team-slack" />);
    await userEvent.type(screen.getByTestId(IntegrationFormTestId.Secret), "xoxb-new");
    await userEvent.click(screen.getByTestId(IntegrationDetailScreenTestId.Save));

    expect(hooks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { id: "team-slack" },
        body: expect.objectContaining({ config: { kind: "slack", channels: ["C1"] } }),
      }),
      expect.anything(),
    );
    // Never folded into the patch — persisted out-of-band as a token.
    expect(JSON.stringify(hooks.update.mock.calls[0]![0])).not.toContain("xoxb-new");
    expect(hooks.setCredentials).toHaveBeenCalledWith({
      params: { id: "team-slack" },
      body: { token: "xoxb-new" },
    });
  });

  it("Test connection fires the test mutation and surfaces the result", async () => {
    hooks.test.mockImplementation(
      (_vars, opts?: { onSuccess?: (r: { body: { ok: boolean; detail: string } }) => void }) =>
        opts?.onSuccess?.({ body: { ok: true, detail: "Slack OK" } }),
    );
    render(<DetailScreen integrationId="team-slack" />);
    await userEvent.click(screen.getByTestId(IntegrationDetailScreenTestId.Test));
    expect(hooks.test).toHaveBeenCalledWith(
      { params: { id: "team-slack" }, body: {} },
      expect.anything(),
    );
    expect(screen.getByTestId(IntegrationDetailScreenTestId.TestResult)).toHaveTextContent(
      "Slack OK",
    );
  });

  it("Delete asks in a CONFIRM dialog, then deletes and returns to the owner's tab", async () => {
    hooks.del.mockImplementation((_args, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    render(<DetailScreen integrationId="team-slack" />);
    await userEvent.click(screen.getByTestId(IntegrationDetailScreenTestId.Delete));
    expect(screen.getByText("Smazat účet?")).toBeInTheDocument();
    const confirm = screen
      .getAllByRole("button", { name: "Smazat" })
      .find((b) => b !== screen.getByTestId(IntegrationDetailScreenTestId.Delete));
    await userEvent.click(confirm!);
    expect(hooks.del).toHaveBeenCalledWith(
      { params: { id: "team-slack" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(push).toHaveBeenCalledWith("/companies/acme?tab=integrations");
  });
});
