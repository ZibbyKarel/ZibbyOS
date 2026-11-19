"use client";

import type { AutomationKey, AutopilotAutomation } from "@zibby/contracts";
import {
  Button,
  type IconName,
  IconTile,
  LaneCell,
  LaneChip,
  LaneHead,
  LaneMatrix,
  type LaneMatrixRow,
  Row,
  Stack,
  Typography,
  ZibbyOrb,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  AUTOMATION_KEYS,
  type AutonomyScope,
  COLUMNS,
  type Column,
  effectiveByNode,
  hasOverride,
  inColumn,
  inheritAll,
  manualKeys,
  overrideOf,
  setLevel,
  toggledLevel,
} from "../autonomy";

export enum AutonomyMatrixTestId {
  Root = "autonomy-matrix",
  /** Suffixed with `-<scope node>-<capability>-<column>`. */
  Chip = "autonomy-matrix-chip",
  Expand = "autonomy-matrix-expand",
  InheritAll = "autonomy-matrix-inherit-all",
  /** Suffixed with the scope node: the "Ručně: …" line. */
  Manual = "autonomy-matrix-manual",
}

interface MatrixRow {
  scope: AutonomyScope;
  nested: boolean;
  teamCount: number;
  open: boolean;
}

export interface AutonomyMatrixProps {
  scopes: AutonomyScope[];
  automation: AutopilotAutomation;
  /** Zibby is paused: the cells are hatched (the settings stay, nothing runs). */
  paused: boolean;
  /** Apply the next tree; `message` is the toast text. */
  onChange: (next: AutopilotAutomation, message: string) => void;
}

/**
 * The levels table: rows = Výchozí, companies and (collapsible) teams; two additive columns,
 * Poloautomat and Automat. Every cell lists all capabilities as toggle chips (on = colour + ✓,
 * off = outline + "+"); a dot marks an exception against the parent row. Setting a capability back
 * to what the parent has removes the exception.
 */
export function AutonomyMatrix({ scopes, automation, paused, onChange }: AutonomyMatrixProps) {
  const t = useTranslations("autopilot");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const eff = effectiveByNode(automation, scopes);
  const byNode = new Map(scopes.map((s) => [s.node, s]));
  const parentOf = (scope: AutonomyScope) => (scope.parent ? byNode.get(scope.parent) : undefined);
  const name = (scope: AutonomyScope) => (scope.kind === "global" ? t("globalLabel") : scope.label);

  const rows: MatrixRow[] = scopes.flatMap((scope) => {
    const parent = parentOf(scope);
    if (parent?.kind === "company" && closed[parent.node]) return [];
    const teamCount =
      scope.kind === "company" ? scopes.filter((s) => s.parent === scope.node).length : 0;
    return [{ scope, nested: parent?.kind === "company", teamCount, open: !closed[scope.node] }];
  });

  const toggle = (scope: AutonomyScope, key: AutomationKey, column: Column) => {
    const parent = parentOf(scope);
    const level = eff[scope.node]?.[key] ?? "manual";
    const next = toggledLevel(level, column);
    const nextTree = setLevel(
      automation,
      scope,
      (parent ? eff[parent.node] : undefined) ?? eff[scope.node] ?? automation.global,
      key,
      next,
    );
    const inherits = scope.kind !== "global" && overrideOf(nextTree, scope)?.[key] === undefined;
    const note =
      column === "semi" && level === "auto" && next === "manual"
        ? t("toastAlsoAutoOff")
        : column === "auto" && level === "manual" && next === "auto"
          ? t("toastAlsoSemiOn")
          : "";
    onChange(
      nextTree,
      `${t(key)} · ${name(scope)} → ${t(`level_${next}`)}${note}${inherits ? ` ${t("toastInheritsAgain")}` : ""}`,
    );
  };

  const cell = (scope: AutonomyScope, column: Column) => {
    const parent = parentOf(scope);
    return (
      <LaneCell
        aria-label={t("cellLabel", { column: t(`col_${column}`), scope: name(scope) })}
        capped={paused}
        key={column}
        role="group"
      >
        {AUTOMATION_KEYS.map((key) => {
          const level = eff[scope.node]?.[key] ?? "manual";
          const own = scope.kind !== "global" && overrideOf(automation, scope)?.[key] !== undefined;
          const parentName = parent ? name(parent) : "";
          return (
            <LaneChip
              aria-label={
                own ? t("chipExceptionAria", { cap: t(key), parent: parentName }) : t(key)
              }
              data-testid={`${AutonomyMatrixTestId.Chip}-${scope.node}-${key}-${column}`}
              key={key}
              onClick={() => toggle(scope, key, column)}
              own={own}
              pressed={inColumn(level, column)}
              title={
                own
                  ? t("chipExceptionTitle", { parent: parentName })
                  : parent
                    ? t("chipSameTitle", { parent: parentName })
                    : undefined
              }
              tone={column}
            >
              {t(key)}
            </LaneChip>
          );
        })}
      </LaneCell>
    );
  };

  const rowHeader = ({ scope, teamCount, open }: MatrixRow) => {
    const parent = parentOf(scope);
    const own = hasOverride(overrideOf(automation, scope));
    const manual = manualKeys(eff[scope.node] ?? automation.global);
    const glyph: IconName =
      scope.kind === "global" ? "globe" : scope.kind === "company" ? "building" : "users";
    const kind =
      scope.kind === "global"
        ? t("globalSub")
        : scope.kind === "company"
          ? t("companyKind")
          : t("teamKind", { company: scope.companyName ?? "" });
    return (
      <Row align="start" gap="100">
        <IconTile glyph={glyph} size="sm" tone="neutral" />
        <Stack gap="25">
          <Typography type="label" variant="primary">
            {name(scope)}
          </Typography>
          <Typography size="xs" type="note" variant="tertiary">
            {scope.kind === "global"
              ? kind
              : own
                ? t("rowOwn", { kind })
                : t("rowInherits", { kind, parent: parent ? name(parent) : "" })}
          </Typography>
          {manual.length > 0 ? (
            <Typography
              data-testid={`${AutonomyMatrixTestId.Manual}-${scope.node}`}
              size="xs"
              type="note"
              variant="secondary"
            >
              {manual.length === AUTOMATION_KEYS.length
                ? t("manualAll")
                : t("manualList", { list: manual.map((k) => t(k)).join(", ") })}
            </Typography>
          ) : null}
          {teamCount > 0 || (scope.kind !== "global" && own) ? (
            <Row wrap gap="50">
              {teamCount > 0 ? (
                <Button
                  aria-expanded={open}
                  aria-label={`${open ? t("collapse") : t("expand")}: ${scope.label}`}
                  data-testid={`${AutonomyMatrixTestId.Expand}-${scope.node}`}
                  icon="chevron"
                  intent="ghost"
                  onClick={() => setClosed((c) => ({ ...c, [scope.node]: open }))}
                  size="sm"
                >
                  {t("teamsCount", { count: teamCount })}
                </Button>
              ) : null}
              {scope.kind !== "global" && own ? (
                <Button
                  data-testid={`${AutonomyMatrixTestId.InheritAll}-${scope.node}`}
                  icon="retry"
                  intent="ghost"
                  onClick={() =>
                    onChange(
                      inheritAll(automation, scope),
                      t("toastInheritAll", {
                        scope: name(scope),
                        parent: parent ? name(parent) : "",
                      }),
                    )
                  }
                  size="sm"
                  title={t("inheritAllTitle", { parent: parent ? name(parent) : "" })}
                >
                  {t("inheritAll")}
                </Button>
              ) : null}
            </Row>
          ) : null}
        </Stack>
      </Row>
    );
  };

  return (
    <div data-testid={AutonomyMatrixTestId.Root}>
      <LaneMatrix
        caption={t("tableCaption")}
        columns={COLUMNS.map((column) => ({
          key: column,
          header: (
            <LaneHead
              icon={<ZibbyOrb size={16} state={column === "semi" ? "think" : "speak"} />}
              meaning={t(`colMeaning_${column}`)}
              title={t(`col_${column}`)}
              tone={column}
            />
          ),
        }))}
        rowHeader={t("tableName")}
        rows={rows.map(
          (r): LaneMatrixRow => ({
            key: r.scope.node,
            header: rowHeader(r),
            cells: COLUMNS.map((column) => cell(r.scope, column)),
            nested: r.nested,
            tinted: r.scope.kind === "global",
          }),
        )}
      />
    </div>
  );
}
