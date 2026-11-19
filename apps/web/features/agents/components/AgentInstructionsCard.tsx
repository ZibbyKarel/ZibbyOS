"use client";

import { useState } from "react";
import { useDetailT } from "../useDetailT";
import {
  Container,
  Icon,
  Markdown,
  Panel,
  SegmentedControl,
  Stack,
  Typography,
} from "@zibby/design-system";
import { FormMarkdownEditor } from "@zibby/forms";
import { AgentDetailScreenTestId as TestId } from "../agentTestIds";
import type { AgentEditValues } from "./agentEditValues";

export interface AgentInstructionsCardProps {
  fileName: string;
  /** The live Markdown body (from the form) — drives the preview and the footer counts. */
  value: string;
  dirty: boolean;
}

/** `{chars, words}` of the Markdown body, for the editor footer. */
export function textCounts(value: string): { chars: number; words: number } {
  const trimmed = value.trim();
  return { chars: value.length, words: trimmed ? trimmed.split(/\s+/).length : 0 };
}

/**
 * The hero of the page: the `agent.md` body as the main column — Markdown editor or
 * rendered preview, with a char / word footer. The frontmatter is generated server-side
 * from the settings cards, so the editor only ever holds the body.
 */
export function AgentInstructionsCard({ fileName, value, dirty }: AgentInstructionsCardProps) {
  const t = useDetailT();
  const [mode, setMode] = useState<"md" | "pv">("md");
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
      }
    >
      <Container padding="150">
        {mode === "md" ? (
          <FormMarkdownEditor<AgentEditValues>
            ariaLabel={t("instructionsAria")}
            name="instructions"
            placeholder={t("instructionsPlaceholder")}
          />
        ) : (
          <Container data-testid={TestId.Preview} minHeight="420px" padding="100">
            {value.trim() ? (
              <Markdown source={value} />
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
          <Typography mono size="xs" type="note" variant="tertiary">
            {t("counts", { chars, words })}
          </Typography>
          <Typography size="xs" type="note" variant="tertiary">
            {t("editorHint")}
          </Typography>
          <Typography size="xs" type="note" variant="tertiary">
            {t("frontmatterNote")}
          </Typography>
        </Stack>
      </Container>
    </Panel>
  );
}
