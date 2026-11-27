import type { IntendedAction } from "@zibby/contracts";

/**
 * The detail an approval card shows for a mid-run intent. The action's own `context`
 * (the hook packs the key fact there) wins; otherwise the key fact is composed from the
 * structured intent (branch(es), scope, tool) so the card never shows only a generic
 * run prompt. `fallback` is appended as secondary context.
 */
export function intentApprovalDetail(action: IntendedAction, fallback?: string): string {
  if (action.context) return action.context;
  const target = action.branch ?? action.branches?.join(", ") ?? action.scope;
  const head = [
    action.action,
    target ? `→ ${target}` : undefined,
    action.tool ? `(${action.tool})` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  return fallback ? `${head}\n\n${fallback}` : head;
}
