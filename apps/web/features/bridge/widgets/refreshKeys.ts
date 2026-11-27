import type { QueryKey } from "@tanstack/react-query";
import { getAgentsQueryKey } from "../../agents/queries/useAgentsQuery";
import { getAiProvidersQueryKey } from "../../ai-providers/queries/useAiProvidersQuery";
import { getAiProvidersSpendQueryKey } from "../../ai-providers/queries/useAiProvidersSpendQuery";
import { getApprovalsQueryKey } from "../../approvals/queries/keys";
import { getAutomationsQueryKey } from "../../automations/queries/useAutomationsQuery";
import { getCompaniesQueryKey } from "../../companies/queries/useCompaniesQuery";
import { getConnectedServicesQueryKey } from "../../connected-services/queries/useConnectedServicesQuery";
import { getGoalsQueryKey } from "../../goals/queries/useGoalsQuery";
import { getInboxPrsQueryKey } from "../../inbox/queries/useInboxPrsQuery";
import { getChannelItemsQueryKey } from "../../integrations/queries/useChannelItemsQuery";
import { getNotePinsQueryKey } from "../../notes/queries/useNotePinsQuery";
import { getNoteTreeQueryKey } from "../../notes/queries/useNoteTreeQuery";
import { getPinsQueryKey } from "../../pins/queries/usePinsQuery";
import { getBudgetQueryKey } from "../../projects/queries/keys";
import { getProjectsQueryKey } from "../../projects/queries/useProjectsQuery";
import { getProposalsQueryKey } from "../../proposals/queries/useProposalsQuery";
import { taskRunsRootKey } from "../../runs/queries/keys";
import { getTeamsQueryKey } from "../../teams/queries/useTeamsQuery";
import { getTodoQueryKey } from "../../todo/queries/useTodoQuery";
import { getWorkflowsQueryKey } from "../../workflows/queries/useWorkflowsQuery";
import type { WidgetType } from "../grid/layout";

/**
 * Cache keys (prefixes) each widget body reads — the frame's refresh button invalidates exactly
 * these. A widget that reports its own `onRefresh` (a server-side sync: PRs, issues, briefing — they have no entry here)
 * overrides this. Widgets without an entry show no refresh button.
 */
export const WIDGET_REFRESH_KEYS: Partial<Record<WidgetType, readonly QueryKey[]>> = {
  indicators: [getApprovalsQueryKey(), getBudgetQueryKey(), getInboxPrsQueryKey()],
  runs: [taskRunsRootKey, getApprovalsQueryKey(), getWorkflowsQueryKey()],
  automationRuns: [getAutomationsQueryKey(), taskRunsRootKey],
  pins: [getPinsQueryKey(), getAgentsQueryKey(), getWorkflowsQueryKey()],
  todo: [getTodoQueryKey()],
  quickActions: [getAgentsQueryKey(), getWorkflowsQueryKey()],
  teamKb: [getTeamsQueryKey()],
  proposals: [getProposalsQueryKey()],
  budgets: [
    getAiProvidersQueryKey(),
    getAiProvidersSpendQueryKey(),
    getBudgetQueryKey(),
    getCompaniesQueryKey(),
    getProjectsQueryKey(),
  ],
  mentions: [getChannelItemsQueryKey()],
  projectStatus: [["project-ci"], getProjectsQueryKey()],
  notes: [getNotePinsQueryKey(), getNoteTreeQueryKey()],
  connectedServices: [getConnectedServicesQueryKey()],
  goals: [getGoalsQueryKey()],
};
