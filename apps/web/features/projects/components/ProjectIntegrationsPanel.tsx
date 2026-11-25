"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Panel, Stack, Tag, Typography } from "@zibby/design-system";
import {
  type IntegrationRoutingRule,
  type RoutingMatch,
  githubRepoFor,
  gitlabRepoFor,
} from "@zibby/contracts";
import { accountHref } from "../../integrations/accountHref";
import { INTEGRATION_KIND_LABEL_KEY } from "../../integrations/kindIcon";
import { useUpdateProjectMutation } from "../mutations";
import { useResolvedProjectQuery } from "../queries";
import { IntegrationRoutingEditor } from "./IntegrationRoutingEditor";

export enum ProjectIntegrationsPanelTestId {
  Root = "project-integrations",
  Row = "project-integration",
  Source = "project-integration-source",
  Empty = "project-integrations-empty",
  GithubRemote = "project-integration-github-remote",
  GitlabRemote = "project-integration-gitlab-remote",
}

export interface ProjectIntegrationsPanelProps {
  projectId: string;
  /** The project's own routing rules (`Project.integrationRouting`). */
  routing?: IntegrationRoutingRule[];
  /** The project's `gitRemote` — the repo a GitHub / GitLab account covers for it. */
  gitRemote?: string | undefined;
}

/**
 * The accounts that serve this project (read-only, the server-resolved set): its company's
 * accounts first, then the operator's personal ones. Each row names where it comes from and
 * links to the account; Jira / Slack carry the project's routing rule (which of the shared
 * account's items belong HERE), GitHub / GitLab the repo its `gitRemote` resolves to.
 * Accounts are created and edited on the company or in Settings → Accounts.
 */
export function ProjectIntegrationsPanel({
  projectId,
  routing = [],
  gitRemote,
}: ProjectIntegrationsPanelProps) {
  const t = useTranslations("projects.integrations");
  const tk = useTranslations();
  const resolvedQ = useResolvedProjectQuery(projectId);
  const updateProject = useUpdateProjectMutation();
  const accounts = resolvedQ.data?.integrations ?? [];
  const companyName = resolvedQ.data?.companyName;

  // ponytail: one rule per account in the UI; saving replaces all of that account's rules.
  function saveRule(integrationId: string, match: RoutingMatch | null) {
    const others = routing.filter((r) => r.integrationId !== integrationId);
    updateProject.mutate({
      params: { id: projectId },
      body: { integrationRouting: match ? [...others, { integrationId, match }] : others },
    });
  }

  return (
    <Panel data-testid={ProjectIntegrationsPanelTestId.Root} header={t("title")} padding="200">
      <Stack gap="200">
        <Typography size="xs" type="note" variant="tertiary">
          {t("hint")}
        </Typography>

        {accounts.length === 0 && (
          <Typography
            data-testid={ProjectIntegrationsPanelTestId.Empty}
            size="sm"
            type="note"
            variant="tertiary"
          >
            {t("empty")}
          </Typography>
        )}

        {accounts.map((account) => {
          const rule = routing.find((r) => r.integrationId === account.id);
          const githubRepo = githubRepoFor(account, { gitRemote });
          const gitlabRepo = gitlabRepoFor(account, { gitRemote });
          return (
            <Stack
              data-testid={`${ProjectIntegrationsPanelTestId.Row}-${account.id}`}
              gap="100"
              key={account.id}
            >
              <Stack wrap align="center" direction="row" gap="100">
                <Tag>{tk(INTEGRATION_KIND_LABEL_KEY[account.kind])}</Tag>
                <Link href={accountHref(account)}>
                  <Typography size="sm" type="text">
                    {account.name ?? account.id}
                  </Typography>
                </Link>
                <Tag data-testid={ProjectIntegrationsPanelTestId.Source} tone="accent">
                  {account.companyId
                    ? t("inherited.fromCompany", { name: companyName ?? account.companyId })
                    : t("inherited.personal")}
                </Tag>
              </Stack>

              {(account.kind === "jira" || account.kind === "slack") && (
                <IntegrationRoutingEditor
                  key={JSON.stringify(rule ?? null)}
                  kind={account.kind}
                  onSave={(match) => saveRule(account.id, match)}
                  rule={rule}
                  saving={updateProject.isPending}
                />
              )}

              {account.kind === "github" && (
                <Typography
                  data-testid={ProjectIntegrationsPanelTestId.GithubRemote}
                  size="xs"
                  tone={githubRepo ? undefined : "warn"}
                  type="note"
                  variant="tertiary"
                >
                  {githubRepo
                    ? t("inherited.githubRoutedBy", { repo: githubRepo })
                    : t("inherited.githubNoRemote")}
                </Typography>
              )}

              {account.config.kind === "gitlab" && (
                <Typography
                  data-testid={ProjectIntegrationsPanelTestId.GitlabRemote}
                  size="xs"
                  tone={gitlabRepo ? undefined : "warn"}
                  type="note"
                  variant="tertiary"
                >
                  {gitlabRepo
                    ? t("inherited.gitlabRoutedBy", { repo: gitlabRepo })
                    : t("inherited.gitlabNoRemote", { host: account.config.host })}
                </Typography>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Panel>
  );
}
