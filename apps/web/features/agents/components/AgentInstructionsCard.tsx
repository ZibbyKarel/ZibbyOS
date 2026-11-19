"use client";

import { useState } from "react";
import { useDetailT } from "../useDetailT";
import {
  Button,
  Container,
  Icon,
  Markdown,
  Panel,
  SegmentedControl,
  SourceEditor,
  Stack,
  Typography,
} from "@zibby/design-system";
import { Controller, useFormContext } from "@zibby/forms";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { AgentDetailScreenTestId as TestId } from "../agentTestIds";
import type { AgentEditValues } from "./agentEditValues";

export interface AgentInstructionsCardProps {
  fileName: string;
  /** The live Markdown body (from the form) — drives the preview and the footer counts. */
  value: string;
  dirty: boolean;
  /** The generated YAML block, shown read-only by the "Frontmatter" toggle. */
  frontmatter: string;
}

/** `{chars, words}` of the Markdown body, for the editor footer. */
export function textCounts(value: string): { chars: number; words: number } {
  const trimmed = value.trim();
  return { chars: value.length, words: trimmed ? trimmed.split(/\s+/).length : 0 };
}

/**
 * The hero of the page: the `agent.md` body as the main column — a code-style Markdown
 * source editor (line numbers, light highlighting) or the rendered preview, in a fixed-height
 * frame that scrolls inside, with a char / word footer. The frontmatter is generated
 * server-side from the settings cards; the toggle only previews it.
 */
export function AgentInstructionsCard({
  fileName,
  value,
  dirty,
  frontmatter,
}: AgentInstructionsCardProps) {
  const t = useDetailT();
  const { control } = useFormContext<AgentEditValues>();
  const phone = useIsPhone();
  const [mode, setMode] = useState<"md" | "pv">("md");
  const [showFrontmatter, setShowFrontmatter] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { chars, words } = textCounts(value);

  return (
    <Panel
      header={
        <Stack align="center" direction="row" gap="100">
          <Icon name="file" size="sm" tone="faint" />
          <Typography mono size="xs" type="note" variant="secondary">
            {fileName}
          </Typography>
          {dirty && (
            <Typography size="2xs" type="note" variant="tertiary">
              {t("edited")}
            </Typography>
          )}
        </Stack>
      }
      headerEnd={
        <Stack align="center" direction="row" gap="100">
          <Button
            aria-label={t("frontmatter")}
            aria-pressed={showFrontmatter}
            data-testid={TestId.FrontmatterToggle}
            icon="code"
            intent="ghost"
            onClick={() => setShowFrontmatter((s) => !s)}
            size="sm"
          >
            {phone ? undefined : t("frontmatter")}
          </Button>
          <SegmentedControl
            ariaLabel={t("editorMode")}
            items={[
              { value: "md", label: t("markdown") },
              { value: "pv", label: t("preview") },
            ]}
            onChange={(v) => setMode(v as "md" | "pv")}
            size="sm"
            value={mode}
          />
          {!phone && (
            <Button
              aria-label={t("expandEditor")}
              aria-pressed={expanded}
              icon="expand"
              intent="ghost"
              onClick={() => setExpanded((e) => !e)}
              size="sm"
            />
          )}
        </Stack>
      }
    >
      {showFrontmatter && (
        <Container padding="150">
          <Typography
            mono
            as="div"
            data-testid={TestId.Frontmatter}
            size="xs"
            style={{ whiteSpace: "pre-wrap" }}
            type="note"
            variant="secondary"
          >
            {frontmatter}
          </Typography>
        </Container>
      )}
      <Container height={expanded ? "78vh" : "560px"} overflow="hidden">
        {mode === "md" ? (
          <Controller<AgentEditValues, "instructions">
            control={control}
            name="instructions"
            render={({ field }) => (
              <SourceEditor
                ariaLabel={t("instructionsAria")}
                onChange={field.onChange}
                placeholder={t("instructionsPlaceholder")}
                value={field.value}
              />
            )}
          />
        ) : (
          <Container
            data-testid={TestId.Preview}
            height="100%"
            overflowY="auto"
            padding={["150", "200"]}
          >
            {value.trim() ? (
              <Markdown compact source={value} />
            ) : (
              <Typography size="sm" type="note" variant="tertiary">
                {t("previewEmpty")}
              </Typography>
            )}
          </Container>
        )}
      </Container>
      <Container padding={["100", "150"]}>
        <Stack wrap align="center" direction="row" gap="150" justify="between">
          <Stack align="center" direction="row" gap="200">
            <Typography mono size="xs" type="note" variant="tertiary">
              {t("counts", { chars, words })}
            </Typography>
            <Typography size="xs" type="note" variant="tertiary">
              {t("editorHint")}
            </Typography>
          </Stack>
          <Typography size="xs" type="note" variant="tertiary">
            {t("frontmatterNote")}
          </Typography>
        </Stack>
      </Container>
    </Panel>
  );
}
