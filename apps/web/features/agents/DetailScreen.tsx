"use client";

import { QueryError } from "../../components/LoadError/QueryError";
import { QueryLoading } from "../../components/LoadingState/QueryLoading";
import { AgentEditor } from "./components/AgentEditor";
import { useAgentQuery } from "./queries";

export { AgentDetailScreenTestId } from "./agentTestIds";

export interface AgentDetailScreenProps {
  agentId: string;
}

/**
 * The `/workforce/agents/:id` page: loads the agent and hands it to the shared
 * {@link AgentEditor} profile layout (hero, instructions, settings cards, tabs).
 */
export function DetailScreen({ agentId }: AgentDetailScreenProps) {
  const query = useAgentQuery(agentId);
  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;
  if (query.isPending) return <QueryLoading />;
  if (!query.data) return null;
  // The form captures its defaults at mount — key by agent so a different id remounts.
  return <AgentEditor agent={query.data} key={query.data.id} />;
}
