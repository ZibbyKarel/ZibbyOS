"use client";

import { type ReactNode, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { GateRule, GateRuleInput, GlobalGateRule } from "@zibby/contracts";
import {
  Button,
  Card,
  Container,
  Divider,
  Icon,
  MenuButton,
  Stack,
  Tag,
  Typography,
} from "@zibby/design-system";
import { useGateRulesQuery, useSystemPolicyQuery } from "../../gates";
import { DecisionBadge } from "../../gates/components/RuleParts";
import { matchText } from "../../gates/gate";
import { useDetailT } from "../useDetailT";

export interface AgentRulesSectionProps {
  /** Display name of the agent whose rules are being edited. */
  agentName: string;
  /** The agent's own rules (frontmatter `gates`); editable here. */
  gates: GateRuleInput[];
  /** Ids of linked global catalog rules (frontmatter `gateRuleIds`). */
  gateRuleIds: string[];
  onAddRule: () => void;
  onEditRule: (index: number) => void;
  onDeleteRule: (index: number) => void;
  onLinkedChange: (ids: string[]) => void;
}

interface RuleRowProps {
  rule: Pick<GateRule, "match" | "decision">;
  /** Muted second line (the catalog rule's name). */
  note?: string;
  decisionLabel: string;
  /** Right-hand slot: the rule's source, a chip or the row actions. */
  end: ReactNode;
  /** Struck through: a lower layer tightened this rule. */
  overridden?: boolean;
}

/** `bash: rm -rf /*` — the rule's AND-ed conditions as one mono line. */
function patternText(match: GateRule["match"]): string {
  return match
    .map((c) => {
      const { lead, pattern } = matchText(c);
      return pattern ? `${lead}: ${pattern}` : lead;
    })
    .join(" & ");
}

/** One rule row: decision badge, mono pattern over a muted note, source / actions at the right. */
function RuleRow({ rule, note, decisionLabel, end, overridden }: RuleRowProps) {
  return (
    <Container padding={["100", "150"]}>
      <Stack align="center" direction="row" gap="150">
        <Container shrink={false} width="64px">
          <DecisionBadge decision={rule.decision} label={decisionLabel} />
        </Container>
        <Container grow minW0>
          <Stack gap="25">
            <Typography
              mono
              size="sm"
              strike={overridden}
              type="note"
              variant={overridden ? "tertiary" : "primary"}
            >
              {patternText(rule.match)}
            </Typography>
            {note && (
              <Typography mono size="2xs" type="note" variant="tertiary">
                {note}
              </Typography>
            )}
          </Stack>
        </Container>
        {end}
      </Stack>
    </Container>
  );
}

interface LayerProps {
  layer: number;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}

/** A numbered layer card: header (badge, title, subtitle, action) over divided rows. */
function Layer({ layer, title, subtitle, action, children }: LayerProps) {
  return (
    <Card background="panel" radius="sm">
      <Container padding={["100", "150"]}>
        <Stack align="center" direction="row" gap="100" justify="between">
          <Stack align="center" direction="row" gap="100">
            <Tag>{layer}</Tag>
            <Typography size="sm" type="note" weight="bold">
              {title}
            </Typography>
            <Typography size="xs" type="note" variant="tertiary">
              {subtitle}
            </Typography>
          </Stack>
          {action}
        </Stack>
      </Container>
      <Divider />
      {children}
    </Card>
  );
}

function Rows({ children }: { children: ReactNode[] }) {
  return (
    <Stack>
      {children.map((row, i) => (
        <div key={i}>
          {i > 0 && <Divider />}
          {row}
        </div>
      ))}
    </Stack>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <Container padding="150">
      <Typography mono size="xs" type="note" variant="tertiary">
        {children}
      </Typography>
    </Container>
  );
}

/**
 * The "Rules" tab of the agent editor — three layers, evaluated top-down: the locked system
 * floor (read-only), the linked global catalog rules (link / unlink here), and the agent's own
 * rules (editable). Own rules and links persist on the agent via the editor's single Save; the
 * floor is enforced server-side regardless.
 */
export function AgentRulesSection({
  gates,
  gateRuleIds,
  onAddRule,
  onEditRule,
  onDeleteRule,
  onLinkedChange,
}: AgentRulesSectionProps) {
  const t = useTranslations("gates");
  const td = useDetailT();
  const { data: inherited = [] } = useSystemPolicyQuery();
  const { data: globalRules = [] } = useGateRulesQuery();

  const decisionLabel = (d: GateRule["decision"]) => t(`decision_.${d}`);

  const linked = useMemo(
    () =>
      gateRuleIds
        .map((id) => globalRules.find((r) => r.id === id))
        .filter((r): r is GlobalGateRule => Boolean(r)),
    [gateRuleIds, globalRules],
  );
  const available = useMemo(
    () => globalRules.filter((r) => !gateRuleIds.includes(r.id)),
    [globalRules, gateRuleIds],
  );
  /** A catalog rule an own rule re-decides for the same match: the lower layer wins. */
  const tightened = (rule: GlobalGateRule) =>
    gates.some(
      (g) => g.decision !== rule.decision && JSON.stringify(g.match) === JSON.stringify(rule.match),
    );

  return (
    <Stack gap="150">
      <Stack align="center" direction="row" gap="150" justify="between">
        <Typography size="sm" type="note" variant="secondary">
          {td("rulesIntro")}
        </Typography>
        <Stack align="center" direction="row" gap="75">
          {(["allow", "ask", "deny"] as const).map((d) => (
            <DecisionBadge decision={d} key={d} label={decisionLabel(d)} />
          ))}
        </Stack>
      </Stack>

      <Layer
        action={<Icon name="lock" size="sm" tone="faint" />}
        layer={1}
        subtitle={td("systemSub")}
        title={td("systemTitle")}
      >
        {inherited.length === 0 ? (
          <Empty>{t("noInherited")}</Empty>
        ) : (
          <Rows>
            {inherited.map((rule) => (
              <RuleRow
                decisionLabel={decisionLabel(rule.decision)}
                end={
                  <Typography size="xs" type="note" variant="tertiary">
                    {td("sourceSystem")}
                  </Typography>
                }
                key={rule.id}
                rule={rule}
              />
            ))}
          </Rows>
        )}
      </Layer>

      <Layer
        action={
          available.length > 0 ? (
            <MenuButton
              ariaLabel={td("linkFromCatalog")}
              items={available.map((r) => ({
                id: r.id,
                label: r.name ?? r.id,
                onSelect: () => onLinkedChange([...gateRuleIds, r.id]),
              }))}
              renderTrigger={(props) => (
                <Button {...props} icon="plus" intent="ghost" size="sm">
                  {td("linkFromCatalog")}
                </Button>
              )}
            />
          ) : undefined
        }
        layer={2}
        subtitle={td("catalogSub", { count: linked.length })}
        title={td("catalogTitle")}
      >
        {linked.length === 0 ? (
          <Empty>{t("noLinked")}</Empty>
        ) : (
          <Rows>
            {linked.map((rule) => {
              const over = tightened(rule);
              return (
                <RuleRow
                  decisionLabel={decisionLabel(rule.decision)}
                  end={
                    <Stack align="center" direction="row" gap="75">
                      {over ? (
                        <Tag>{td("tightenedBelow")}</Tag>
                      ) : (
                        <Typography size="xs" type="note" variant="tertiary">
                          {td("sourceCatalog")}
                        </Typography>
                      )}
                      <Button
                        aria-label={t("unlink")}
                        icon="x"
                        intent="ghost"
                        onClick={() => onLinkedChange(gateRuleIds.filter((id) => id !== rule.id))}
                        size="sm"
                      />
                    </Stack>
                  }
                  key={rule.id}
                  note={rule.name}
                  overridden={over}
                  rule={rule}
                />
              );
            })}
          </Rows>
        )}
      </Layer>

      <Layer
        action={
          <Button icon="plus" intent="ghost" onClick={onAddRule} size="sm">
            {t("addRule")}
          </Button>
        }
        layer={3}
        subtitle={td("ownSub")}
        title={td("ownTitle")}
      >
        {gates.length === 0 ? (
          <Empty>{t("noOwnRules")}</Empty>
        ) : (
          <Rows>
            {gates.map((rule, i) => (
              <RuleRow
                decisionLabel={decisionLabel(rule.decision)}
                end={
                  <Stack align="center" direction="row" gap="25">
                    <Button
                      aria-label={t("edit")}
                      icon="edit"
                      intent="ghost"
                      onClick={() => onEditRule(i)}
                      size="sm"
                    />
                    <Button
                      aria-label={t("delete")}
                      icon="trash"
                      intent="ghost"
                      onClick={() => onDeleteRule(i)}
                      size="sm"
                    />
                  </Stack>
                }
                key={i}
                rule={rule}
              />
            ))}
          </Rows>
        )}
      </Layer>
    </Stack>
  );
}
