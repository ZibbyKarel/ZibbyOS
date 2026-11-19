"use client";

import { type AutomationKey, type AutopilotAutomation, NO_AUTOMATION } from "@zibby/contracts";
import {
  Button,
  Icon,
  type IconName,
  IconTile,
  LaneCell,
  LaneChip,
  LaneHead,
  LaneMatrix,
  type LaneMatrixRow,
  MenuButton,
  type MenuButtonEntry,
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
  GLOBAL_NODE,
  LANES,
  type Lane,
  effectiveByNode,
  inheritAll,
  inheritCap,
  laneOf,
  moveCap,
  overrideOf,
} from "../autonomy";
import { MODE_ORB } from "../modeMeta";

export enum AutonomyMatrixTestId {
  Root = "autonomy-matrix",
  Chip = "autonomy-matrix-chip",
  Lane = "autonomy-matrix-lane",
  Expand = "autonomy-matrix-expand",
  InheritAll = "autonomy-matrix-inherit-all",
}

const CAP_ICON: Record<AutomationKey, IconName> = {
  autoReview: "branch",
  autoAddressComments: "pen",
  autoImplement: "code",
  autoCommunicate: "chat",
  autoFixCi: "bug",
};

interface MatrixRow {
  scope: AutonomyScope;
  depth: number;
  hasChildren: boolean;
  open: boolean;
}

export interface AutonomyMatrixProps {
  scopes: AutonomyScope[];
  automation: AutopilotAutomation;
  /** False without an operator token or while a save runs: chips are locked. */
  editable: boolean;
  /** Header level is Poloautomat: the Automat lane is capped (hatched, "now as Poloautomat"). */
  autoCapped: boolean;
  /** Apply the next tree; `message` is the toast text. */
  onChange: (next: AutopilotAutomation, message: string, focusId?: string) => void;
}

/**
 * The scope × lane matrix: rows = Výchozí, companies and (collapsible) teams, one column per lane.
 * Each capability is a chip in exactly one lane per row, moved by drag, click menu or ←/→ (Manuál
 * ↔ Automat; the Poloautomat cell lane is a disabled target, not representable today). Inherited chips are plain text, own overrides
 * carry a fill and a dot. The Výchozí row is locked (the web keeps `global` all-off).
 */
export function AutonomyMatrix({
  scopes,
  automation,
  editable,
  autoCapped,
  onChange,
}: AutonomyMatrixProps) {
  const t = useTranslations("autopilot");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<{ node: string; key: AutomationKey } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const eff = effectiveByNode(automation, scopes);
  const byNode = new Map(scopes.map((s) => [s.node, s]));
  const hasChildren = new Set(scopes.flatMap((s) => (s.parent ? [s.parent] : [])));

  const rows: MatrixRow[] = scopes.flatMap((scope) => {
    const parent = scope.parent ? byNode.get(scope.parent) : undefined;
    if (parent?.kind === "company" && closed[parent.node]) return [];
    const kids = hasChildren.has(scope.node) && scope.kind === "company";
    return [
      {
        scope,
        depth: parent?.kind === "company" ? 1 : 0,
        hasChildren: kids,
        open: kids && !closed[scope.node],
      },
    ];
  });

  const parentOf = (scope: AutonomyScope) => (scope.parent ? byNode.get(scope.parent) : undefined);
  const parentEff = (scope: AutonomyScope) =>
    (scope.parent ? eff[scope.parent] : undefined) ?? NO_AUTOMATION;
  const chipId = (scope: AutonomyScope, key: AutomationKey) => `${scope.node}:${key}`;

  const move = (scope: AutonomyScope, key: AutomationKey, lane: Lane) => {
    if (lane === "semi" || laneOf(eff[scope.node]?.[key] ?? false) === lane) return;
    const next = moveCap(automation, scope, parentEff(scope), key, lane);
    const inherits = overrideOf(next, scope)?.[key] === undefined;
    onChange(
      next,
      `${t(key)} · ${scope.label} → ${t(`mode_${lane}`)}${inherits ? ` (${t("inheritsAgain")})` : ""}`,
      chipId(scope, key),
    );
  };

  const menuItems = (scope: AutonomyScope, key: AutomationKey): MenuButtonEntry[] => {
    const current = laneOf(eff[scope.node]?.[key] ?? false);
    const parentLabel = parentOf(scope)?.label || t("globalLabel");
    return [
      ...LANES.map((lane) => ({
        id: lane,
        label: t(`mode_${lane}`),
        trailing: current === lane ? "●" : undefined,
        disabled: lane === "semi",
        description:
          lane === "semi"
            ? t("semiCellDisabled")
            : lane === "auto" && key === "autoImplement"
              ? t("implementAutoHint")
              : undefined,
        onSelect: () => move(scope, key, lane),
      })),
      ...(overrideOf(automation, scope)?.[key] !== undefined
        ? [
            { id: "divider", divider: true as const },
            {
              id: "inherit",
              label: t("inheritFrom", { parent: parentLabel }),
              icon: "arrow" as IconName,
              onSelect: () =>
                onChange(
                  inheritCap(automation, scope, key),
                  `${t(key)} · ${scope.label} ${t("inheritsFrom", { parent: parentLabel })}`,
                  chipId(scope, key),
                ),
            },
          ]
        : []),
    ];
  };

  const chip = (scope: AutonomyScope, key: AutomationKey) => {
    const lane = laneOf(eff[scope.node]?.[key] ?? false);
    const own = overrideOf(automation, scope)?.[key] !== undefined;
    const warn = key === "autoImplement" && lane === "auto";
    const locked = scope.kind === "global" || !editable;
    const common = {
      "data-chip": chipId(scope, key),
      "data-lane": lane,
      "data-testid": AutonomyMatrixTestId.Chip,
      hint: warn ? <Icon name="warn" size="xs" tone="warn" /> : undefined,
      icon: <Icon name={CAP_ICON[key]} size="xs" />,
      inherited: scope.kind !== "global" && !own,
      own,
      tone: lane === "auto" ? ("auto" as const) : ("neutral" as const),
      title: warn ? t("implementAutoHint") : undefined,
    };
    const label = `${t(key)}: ${t(`mode_${lane}`)}${own ? "" : `, ${t("inherited")}`}`;
    if (locked) {
      return (
        <LaneChip {...common} locked aria-disabled="true" aria-label={label} key={key}>
          {t(key)}
        </LaneChip>
      );
    }
    return (
      <MenuButton
        ariaLabel={label}
        items={menuItems(scope, key)}
        key={key}
        renderTrigger={(props) => (
          <LaneChip
            {...common}
            {...props}
            draggable
            aria-label={label}
            dragging={drag?.node === scope.node && drag.key === key}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", chipId(scope, key));
              setDrag({ node: scope.node, key });
            }}
            onKeyDown={(e) => {
              const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (step === 0) return props.onKeyDown(e);
              e.preventDefault();
              // Manuál <-> Automat; the disabled Poloautomat lane is skipped.
              const target = step > 0 ? "auto" : "manual";
              if (target !== lane) move(scope, key, target);
            }}
          >
            {t(key)}
          </LaneChip>
        )}
      />
    );
  };

  const laneCell = (scope: AutonomyScope, lane: Lane) => {
    const cellId = `${scope.node}:${lane}`;
    const canDrop = editable && lane !== "semi" && drag?.node === scope.node;
    return (
      <LaneCell
        capped={lane === "auto" && autoCapped}
        data-lane={lane}
        data-testid={AutonomyMatrixTestId.Lane}
        dropTarget={over === cellId}
        empty="—"
        onDragLeave={() => setOver((o) => (o === cellId ? null : o))}
        onDragOver={
          canDrop
            ? (e) => {
                e.preventDefault();
                setOver(cellId);
              }
            : undefined
        }
        onDrop={
          canDrop && drag
            ? (e) => {
                e.preventDefault();
                setOver(null);
                move(scope, drag.key, lane);
                setDrag(null);
              }
            : undefined
        }
        tone={lane === "manual" ? "neutral" : lane}
      >
        {AUTOMATION_KEYS.filter((k) => laneOf(eff[scope.node]?.[k] ?? false) === lane).map((k) =>
          chip(scope, k),
        )}
      </LaneCell>
    );
  };

  const rowHeader = ({ scope, hasChildren: kids, open }: MatrixRow) => {
    const overridden = overrideOf(automation, scope) !== undefined;
    const teamCount = scopes.filter((s) => s.parent === scope.node).length;
    const glyph: IconName =
      scope.kind === "global" ? "globe" : scope.kind === "company" ? "building" : "users";
    return (
      <Row align="start" gap="100">
        <IconTile glyph={glyph} size="sm" tone="neutral" />
        <Stack gap="25">
          <Typography type="label" variant="primary">
            {scope.kind === "global" ? t("globalLabel") : scope.label}
          </Typography>
          <Typography
            size="xs"
            title={scope.kind === "global" ? t("globalLocked") : undefined}
            type="note"
            variant="tertiary"
          >
            {scope.kind === "global"
              ? t("globalSub")
              : scope.kind === "company"
                ? t("companyKind")
                : t("teamKind", { company: scope.companyName ?? "" })}
          </Typography>
          {kids || (editable && overridden) ? (
            <Row wrap gap="50">
              {kids ? (
                <Button
                  aria-expanded={open}
                  aria-label={`${open ? t("collapse") : t("expand")}: ${scope.label}`}
                  data-testid={AutonomyMatrixTestId.Expand}
                  icon="chevron"
                  intent="ghost"
                  onClick={() => setClosed((c) => ({ ...c, [scope.node]: open }))}
                  size="sm"
                >
                  {t("teamsCount", { count: teamCount })}
                </Button>
              ) : null}
              {editable && overridden ? (
                <Button
                  aria-label={`${t("inheritAll")}: ${scope.label}`}
                  data-testid={AutonomyMatrixTestId.InheritAll}
                  icon="arrow"
                  intent="ghost"
                  onClick={() =>
                    onChange(
                      inheritAll(automation, scope),
                      `${scope.label} ${t("inheritsAllFrom", { parent: parentOf(scope)?.label || t("globalLabel") })}`,
                    )
                  }
                  size="sm"
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
        columns={LANES.map((lane) => ({
          key: lane,
          header: (
            <LaneHead
              icon={<ZibbyOrb size={16} state={MODE_ORB[lane]} />}
              meaning={t(`laneMeaning_${lane}`)}
              note={
                lane === "auto" && autoCapped
                  ? t("cappedNote")
                  : lane === "semi"
                    ? t("semiCellDisabled")
                    : undefined
              }
              title={t(`mode_${lane}`)}
              tone={lane === "manual" ? "neutral" : lane}
            />
          ),
        }))}
        rowHeader={t("tableName")}
        rows={rows.map(
          (r): LaneMatrixRow => ({
            key: r.scope.node,
            header: rowHeader(r),
            cells: LANES.map((lane) => laneCell(r.scope, lane)),
            nested: r.depth > 0,
            tinted: r.scope.kind === "global",
          }),
        )}
      />
    </div>
  );
}

export { GLOBAL_NODE };
