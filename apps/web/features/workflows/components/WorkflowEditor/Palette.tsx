"use client";
import { useMemo, useState } from "react";
import type { Agent, Department } from "@zibby/contracts";
import type { IconName } from "@zibby/design-system";
import {
  Button,
  Container,
  EngineBadge,
  Icon,
  IconTile,
  Kbd,
  Pressable,
  SearchInput,
  Stack,
  Typography,
} from "@zibby/design-system";
import { agentSymbol } from "../../../agents/agentSymbol";
import { useEngineBadge } from "../../../ai-providers";
import { PHASE_DND, type PhaseDrop } from "./dnd";
import { useWdT } from "./useWdT";

export enum PaletteTestId {
  Root = "workflow-palette",
  Rail = "workflow-palette-rail",
  Search = "workflow-palette-search",
  Agent = "workflow-palette-agent",
  Tool = "workflow-palette-tool",
  Workflow = "workflow-palette-workflow",
  Open = "workflow-palette-open",
  Close = "workflow-palette-close",
  InsertNote = "workflow-palette-insert-note",
}

export interface PaletteProps {
  agents: readonly Agent[];
  departments?: readonly Department[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (drop: PhaseDrop) => void;
  /** Label of the phase the next pick inserts after (set by a connector's "+"). */
  insertAfterLabel?: string;
  onCancelInsert: () => void;
}

const drag = (drop: PhaseDrop) => (e: React.DragEvent) => {
  e.dataTransfer.effectAllowed = "copy";
  e.dataTransfer.setData(PHASE_DND, JSON.stringify(drop));
};

export function Palette({
  agents,
  departments = [],
  open,
  onOpenChange,
  onAdd,
  insertAfterLabel,
  onCancelInsert,
}: PaletteProps) {
  const t = useWdT("workflowDetail.palette");
  const engineBadge = useEngineBadge();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      agents.filter(
        (a) =>
          !needle ||
          [a.name ?? "", a.id, a.category ?? ""].some((v) => v.toLowerCase().includes(needle)),
      ),
    [agents, needle],
  );
  const steps: { kind: "tool" | "workflow"; icon: IconName; id: PaletteTestId }[] = [
    { kind: "tool", icon: "terminal", id: PaletteTestId.Tool },
    { kind: "workflow", icon: "flow", id: PaletteTestId.Workflow },
  ];
  const shownSteps = steps.filter(
    (s) =>
      !needle ||
      t(s.kind === "tool" ? "toolStep" : "subWorkflow")
        .toLowerCase()
        .includes(needle),
  );

  if (!open) {
    return (
      <Container
        data-testid={PaletteTestId.Rail}
        shrink={false}
        style={{
          width: 48,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 0",
          zIndex: 6,
        }}
      >
        <Button
          aria-label={t("open")}
          data-testid={PaletteTestId.Open}
          icon="plus"
          intent="ghost"
          onClick={() => onOpenChange(true)}
          size="sm"
          title={t("open")}
        />
        {(["users", "terminal", "flow"] as const).map((icon) => (
          <Button
            aria-label={t("open")}
            icon={icon}
            intent="ghost"
            key={icon}
            onClick={() => onOpenChange(true)}
            size="sm"
            tabIndex={-1}
          />
        ))}
      </Container>
    );
  }

  return (
    <Container
      data-testid={PaletteTestId.Root}
      height="100%"
      minHeight="0"
      shrink={false}
      style={{
        width: 252,
        borderRight: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        zIndex: 6,
      }}
    >
      <Stack
        align="center"
        direction="row"
        gap="100"
        justify="between"
        style={{ padding: "10px 10px 8px 14px" }}
      >
        <Typography size="sm" type="note" weight="semibold">
          {t("title")}
        </Typography>
        <Stack align="center" direction="row" gap="50">
          <Kbd>A</Kbd>
          <Button
            aria-label={t("close")}
            data-testid={PaletteTestId.Close}
            icon="x"
            intent="ghost"
            onClick={() => onOpenChange(false)}
            size="sm"
          />
        </Stack>
      </Stack>
      <Container padding={["0", "100", "100", "100"]}>
        <SearchInput
          ariaLabel={t("search")}
          data-testid={PaletteTestId.Search}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          value={q}
        />
      </Container>
      {insertAfterLabel && (
        <Container padding={["0", "100", "100", "100"]}>
          <Stack
            align="center"
            data-testid={PaletteTestId.InsertNote}
            direction="row"
            gap="75"
            justify="between"
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid var(--color-border-strong)",
            }}
          >
            <Typography size="xs" type="note" variant="secondary">
              {t("insertAfter", { phase: insertAfterLabel })}
            </Typography>
            <Button
              aria-label={t("cancelInsert")}
              icon="x"
              intent="ghost"
              onClick={onCancelInsert}
              size="sm"
            />
          </Stack>
        </Container>
      )}

      <Container grow minHeight="0" overflowY="auto" padding={["0", "75", "150", "75"]}>
        <Container padding={["100", "100", "50", "100"]}>
          <Typography uppercase size="2xs" type="note" variant="tertiary">
            {t("agents", { n: filtered.length })}
          </Typography>
        </Container>
        {agents.length === 0 && (
          <Container padding={["50", "100"]}>
            <Typography size="xs" type="note" variant="tertiary">
              {t("noAgents")}
            </Typography>
          </Container>
        )}
        {filtered.map((a) => {
          const sym = agentSymbol(a, departments);
          return (
            <Pressable
              draggable
              aria-label={t("addAgent", { agent: a.name ?? a.id })}
              data-testid={`${PaletteTestId.Agent}-${a.id}`}
              key={a.id}
              onClick={() => onAdd({ kind: "agent", id: a.id })}
              onDragStart={drag({ kind: "agent", id: a.id })}
            >
              <Container padding={["75", "100"]}>
                <Stack align="center" direction="row" gap="100">
                  <EngineBadge {...engineBadge(a)}>
                    <IconTile color={sym.color} glyph={sym.glyph} size="sm" src={a.avatar} />
                  </EngineBadge>
                  <Container grow minW0 textAlign="left">
                    <Typography truncate size="sm" type="note" weight="semibold">
                      {a.name ?? a.id}
                    </Typography>
                    <Typography mono truncate size="2xs" type="note" variant="tertiary">
                      {[a.model, a.category].filter(Boolean).join(" · ")}
                    </Typography>
                  </Container>
                  <Icon name="plus" size="xs" tone="faint" />
                </Stack>
              </Container>
            </Pressable>
          );
        })}

        {shownSteps.length > 0 && (
          <Container padding={["150", "100", "50", "100"]}>
            <Typography uppercase size="2xs" type="note" variant="tertiary">
              {t("steps")}
            </Typography>
          </Container>
        )}
        {shownSteps.map((s) => (
          <Pressable
            draggable
            aria-label={t(s.kind === "tool" ? "addTool" : "addSubWorkflow")}
            data-testid={s.id}
            key={s.kind}
            onClick={() => onAdd({ kind: "step", type: s.kind })}
            onDragStart={drag({ kind: "step", type: s.kind })}
          >
            <Container padding={["75", "100"]}>
              <Stack align="center" direction="row" gap="100">
                <IconTile glyph={s.icon} size="sm" />
                <Container grow minW0 textAlign="left">
                  <Typography truncate size="sm" type="note" weight="semibold">
                    {t(s.kind === "tool" ? "toolStep" : "subWorkflow")}
                  </Typography>
                  <Typography truncate size="2xs" type="note" variant="tertiary">
                    {t(s.kind === "tool" ? "toolHint" : "subWorkflowHint")}
                  </Typography>
                </Container>
                <Icon name="plus" size="xs" tone="faint" />
              </Stack>
            </Container>
          </Pressable>
        ))}
      </Container>
      <Container padding={["100", "150"]} style={{ borderTop: "1px solid var(--color-border)" }}>
        <Typography leading="snug" size="xs" type="note" variant="tertiary">
          {t("footer")}
        </Typography>
      </Container>
    </Container>
  );
}
