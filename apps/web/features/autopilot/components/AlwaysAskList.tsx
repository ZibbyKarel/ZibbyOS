"use client";

import { Chip, Row } from "@zibby/design-system";
import { useGateRulesQuery } from "../../gates";

export enum AlwaysAskListTestId {
  Chip = "always-ask-chip",
}

/**
 * Chips of what still asks in every autonomy level: the locked system gate rules that decide
 * `ask` or `deny` (built-in, never removed; merge, deploy, payments, force push ...).
 */
export function AlwaysAskList() {
  const { data: rules = [] } = useGateRulesQuery();
  return (
    <Row wrap gap="50">
      {rules
        .filter((r) => r.system && (r.decision === "ask" || r.decision === "deny"))
        .map((r) => (
          <Chip data-testid={AlwaysAskListTestId.Chip} key={r.id}>
            {r.name ?? r.id}
          </Chip>
        ))}
    </Row>
  );
}
