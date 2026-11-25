import userEvent from "@testing-library/user-event";
import type { Integration, IntegrationRoutingRule } from "@zibby/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen, within } from "../../../test/render";
import {
  ProjectIntegrationsPanel,
  ProjectIntegrationsPanelTestId as TestId,
} from "./ProjectIntegrationsPanel";
import { IntegrationRoutingEditorTestId } from "./IntegrationRoutingEditor";

const { hooks } = vi.hoisted(() => ({
  hooks: {
    resolved: { data: undefined as unknown },
    update: { mutate: vi.fn(), isPending: false },
  },
}));

vi.mock("../queries", () => ({ useResolvedProjectQuery: () => hooks.resolved }));
vi.mock("../mutations", () => ({ useUpdateProjectMutation: () => hooks.update }));

const jira = {
  id: "jira-shoptet",
  kind: "jira",
  name: "Shoptet Jira",
  companyId: "shoptet",
  enabled: true,
  status: "connected",
  hasCredentials: true,
  config: { kind: "jira", baseUrl: "https://shoptet.atlassian.net", email: "a@b.cz" },
} as Integration;
const github = {
  id: "my-github",
  kind: "github",
  enabled: true,
  status: "connected",
  hasCredentials: true,
  config: { kind: "github", streams: ["issues"], username: "me" },
} as Integration;
const gitlab = {
  id: "gl-shoptet",
  kind: "gitlab",
  companyId: "shoptet",
  enabled: true,
  status: "connected",
  hasCredentials: true,
  config: { kind: "gitlab", host: "gitlab.example.com", streams: ["pulls"], username: "me" },
} as Integration;

function resolved(integrations: Integration[]) {
  hooks.resolved = {
    data: { people: [], integrations, companyId: "shoptet", companyName: "Shoptet" },
  };
}

const slackRule: IntegrationRoutingRule = {
  integrationId: "other",
  match: { kind: "slack", channels: ["C1"] },
};

describe("ProjectIntegrationsPanel", () => {
  beforeEach(() => {
    hooks.update = { mutate: vi.fn(), isPending: false };
    resolved([jira]);
  });

  it("lists the resolved accounts with their source, each linking to its detail page", () => {
    resolved([jira, github]);
    render(<ProjectIntegrationsPanel projectId="p1" />);

    const sources = screen.getAllByTestId(TestId.Source).map((s) => s.textContent);
    expect(sources).toEqual(["Z firmy Shoptet", "Osobní účet"]);
    expect(
      within(screen.getByTestId(`${TestId.Row}-jira-shoptet`)).getByRole("link"),
    ).toHaveAttribute("href", "/companies/shoptet/integrations/jira-shoptet");
    expect(within(screen.getByTestId(`${TestId.Row}-my-github`)).getByRole("link")).toHaveAttribute(
      "href",
      "/system/settings/accounts/my-github",
    );
  });

  it("shows the empty state when no account serves the project", () => {
    resolved([]);
    render(<ProjectIntegrationsPanel projectId="p1" />);
    expect(screen.getByTestId(TestId.Empty)).toBeInTheDocument();
  });

  it("saves a jira rule into integrationRouting, keeping other accounts' rules", async () => {
    render(<ProjectIntegrationsPanel projectId="p1" routing={[slackRule]} />);

    await userEvent.type(screen.getByTestId(IntegrationRoutingEditorTestId.ProjectKey), "CMS");
    await userEvent.click(screen.getByTestId(IntegrationRoutingEditorTestId.Save));

    expect(hooks.update.mutate).toHaveBeenCalledWith({
      params: { id: "p1" },
      body: {
        integrationRouting: [
          slackRule,
          { integrationId: "jira-shoptet", match: { kind: "jira", projectKey: "CMS" } },
        ],
      },
    });
  });

  it("clearing a rule drops only that account's rule", async () => {
    const mine: IntegrationRoutingRule = {
      integrationId: "jira-shoptet",
      match: { kind: "jira", projectKey: "CMS" },
    };
    render(<ProjectIntegrationsPanel projectId="p1" routing={[slackRule, mine]} />);

    await userEvent.click(screen.getByTestId(IntegrationRoutingEditorTestId.Clear));

    expect(hooks.update.mutate).toHaveBeenCalledWith({
      params: { id: "p1" },
      body: { integrationRouting: [slackRule] },
    });
  });

  it("github shows the repo from the git remote, no editor", () => {
    resolved([github]);
    render(<ProjectIntegrationsPanel gitRemote="git@github.com:Shoptet/cli.git" projectId="p1" />);

    expect(screen.getByTestId(TestId.GithubRemote)).toHaveTextContent("shoptet/cli");
    expect(screen.queryByTestId(IntegrationRoutingEditorTestId.Root)).not.toBeInTheDocument();
  });

  it("github without a github.com remote warns", () => {
    resolved([github]);
    render(<ProjectIntegrationsPanel gitRemote="git@gitlab.example.com:a/b.git" projectId="p1" />);
    expect(screen.getByTestId(TestId.GithubRemote)).toHaveTextContent(/git remote/i);
  });

  it("gitlab shows the repo routed by a git remote on its host", () => {
    resolved([gitlab]);
    render(
      <ProjectIntegrationsPanel
        gitRemote="git@gitlab.example.com:group/sub/project.git"
        projectId="p1"
      />,
    );
    expect(screen.getByTestId(TestId.GitlabRemote)).toHaveTextContent("group/sub/project");
  });

  it("gitlab with a remote on another host names the host it needs", () => {
    resolved([gitlab]);
    render(<ProjectIntegrationsPanel gitRemote="git@github.com:Shoptet/cli.git" projectId="p1" />);
    expect(screen.getByTestId(TestId.GitlabRemote)).toHaveTextContent("gitlab.example.com");
  });
});
