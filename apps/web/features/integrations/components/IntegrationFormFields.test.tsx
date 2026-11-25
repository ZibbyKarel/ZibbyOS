import { renderWithProviders as render, screen } from "../../../test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CreateIntegrationInput } from "@zibby/contracts";
import {
  IntegrationFormFields,
  IntegrationFormTestId,
  type IntegrationOwner,
  useIntegrationFormState,
} from "./IntegrationFormFields";

const SUBMIT = "harness-submit";

/** The form + its hook, with a submit button emitting `buildCreate()` and the secret. */
function Harness({
  owner = {},
  onCreate,
}: {
  owner?: IntegrationOwner;
  onCreate: (draft: { create: CreateIntegrationInput; secret?: string | undefined }) => void;
}) {
  const form = useIntegrationFormState(owner);
  return (
    <>
      <IntegrationFormFields form={form} />
      <button
        data-testid={SUBMIT}
        disabled={!form.canSave(true)}
        onClick={() => onCreate({ create: form.buildCreate(), secret: form.newSecret() })}
        type="button"
      >
        submit
      </button>
    </>
  );
}

async function pick(label: string) {
  // The kind selector is always the first `dropdown-trigger` in DOM order.
  await userEvent.click(screen.getAllByTestId("dropdown-trigger")[0]!);
  await userEvent.click(screen.getByText(label));
}

describe("IntegrationFormFields — owner", () => {
  it("a company account carries its companyId; a personal one has none", async () => {
    const onCreate = vi.fn();
    const { unmount } = render(<Harness onCreate={onCreate} owner={{ companyId: "acme" }} />);
    await userEvent.type(screen.getByTestId("integration-id"), "acme-slack");
    await userEvent.click(screen.getByTestId(SUBMIT));
    expect(onCreate.mock.calls[0]![0].create.companyId).toBe("acme");
    unmount();

    render(<Harness onCreate={onCreate} />);
    await userEvent.type(screen.getByTestId("integration-id"), "my-slack");
    await userEvent.click(screen.getByTestId(SUBMIT));
    expect(onCreate.mock.calls[1]![0].create).not.toHaveProperty("companyId");
  });
});

describe("IntegrationFormFields — sentry kind", () => {
  it("selecting sentry renders org/project fields and hides slack fields", async () => {
    render(<Harness onCreate={vi.fn()} />);
    await pick("Sentry");

    expect(screen.getByTestId(IntegrationFormTestId.SentryOrg)).toBeInTheDocument();
    expect(screen.getByTestId(IntegrationFormTestId.SentryProject)).toBeInTheDocument();
    expect(screen.getByTestId(IntegrationFormTestId.SentryBaseUrl)).toBeInTheDocument();
    expect(screen.queryByTestId(IntegrationFormTestId.SlackChannels)).not.toBeInTheDocument();
  });

  it("secret label reads API token for sentry", async () => {
    render(<Harness onCreate={vi.fn()} />);
    await pick("Sentry");
    expect(screen.getByTestId(IntegrationFormTestId.Secret)).toHaveAccessibleName("API token");
  });

  it("buildCreate() yields a valid SentryConfig, with the token carried out-of-band", async () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);
    await pick("Sentry");

    await userEvent.type(screen.getByTestId("integration-id"), "acme-sentry");
    await userEvent.type(screen.getByTestId(IntegrationFormTestId.SentryOrg), "acme");
    await userEvent.type(screen.getByTestId(IntegrationFormTestId.SentryProject), "backend");
    await userEvent.type(screen.getByTestId(IntegrationFormTestId.Secret), "sntrys_secret");
    await userEvent.click(screen.getByTestId(SUBMIT));

    const draft = onCreate.mock.calls[0]![0];
    expect(draft.create.config).toEqual({
      kind: "sentry",
      org: "acme",
      project: "backend",
      minLevel: "error",
    });
    expect(draft.secret).toBe("sntrys_secret");
    expect(JSON.stringify(draft.create)).not.toContain("sntrys_secret");
  });

  it("blocks save until org and project are both filled in", async () => {
    render(<Harness onCreate={vi.fn()} />);
    await pick("Sentry");
    await userEvent.type(screen.getByTestId("integration-id"), "acme-sentry");
    await userEvent.type(screen.getByTestId(IntegrationFormTestId.SentryOrg), "acme");
    expect(screen.getByTestId(SUBMIT)).toBeDisabled();
  });
});

describe("IntegrationFormFields — github kind", () => {
  it("needs only a username, and never sends a repo", async () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} owner={{ companyId: "acme" }} />);
    await pick("GitHub");

    await userEvent.type(screen.getByTestId("integration-id"), "acme-github");
    expect(screen.getByTestId(SUBMIT)).toBeDisabled();
    await userEvent.type(screen.getByTestId(IntegrationFormTestId.GithubUsername), "octocat");
    await userEvent.click(screen.getByTestId(IntegrationFormTestId.GithubIncludeTeams));
    await userEvent.click(screen.getByTestId(SUBMIT));

    expect(onCreate.mock.calls[0]![0].create.config).toEqual({
      kind: "github",
      streams: ["issues", "pulls"],
      username: "octocat",
      includeTeams: true,
    });
  });
});

describe("IntegrationFormFields — gitlab kind", () => {
  it("shows host/username, no repo, no credentials field, and a glab login note", async () => {
    render(<Harness onCreate={vi.fn()} />);
    await pick("GitLab");
    expect(screen.getByTestId(IntegrationFormTestId.GitlabHost)).toBeInTheDocument();
    expect(screen.getByTestId(IntegrationFormTestId.GitlabUsername)).toBeInTheDocument();
    expect(screen.getByTestId(IntegrationFormTestId.GitlabLogin)).toBeInTheDocument();
    expect(screen.queryByTestId(IntegrationFormTestId.Secret)).not.toBeInTheDocument();
  });

  it("buildCreate() yields a GitLabConfig without a repo and no secret", async () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);
    await pick("GitLab");
    await userEvent.type(screen.getByTestId("integration-id"), "my-gitlab");
    await userEvent.type(
      screen.getByTestId(IntegrationFormTestId.GitlabHost),
      "gitlab.example.com",
    );
    await userEvent.type(screen.getByTestId(IntegrationFormTestId.GitlabUsername), "karel.zibar");
    await userEvent.click(screen.getByTestId(SUBMIT));

    const draft = onCreate.mock.calls[0]![0];
    expect(draft.create.config).toEqual({
      kind: "gitlab",
      host: "gitlab.example.com",
      streams: ["issues", "pulls"],
      username: "karel.zibar",
    });
    expect(draft.secret).toBeUndefined();
  });
});
