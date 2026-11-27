"use client";

import { Alert, Button, CopyableText, Stack, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import type { RunView } from "../run";
import { useRunPrUrl } from "../useRunPrUrl";
import { runOutputKind } from "./RunOutputView";

export enum RunArtifactInfoTestId {
  Root = "run-artifact-info",
  Pr = "run-artifact-pr",
  Path = "run-artifact-path",
  Open = "run-artifact-open",
}

export interface RunArtifactInfoProps {
  run: RunView;
  /** A finished run: the artifact is only announced once it is final. */
  done: boolean;
  /** Opens the run folder (desktop bridge: the API opens it in Finder). Workflow runs only. */
  onOpenFolder?: () => void;
  /** Opens the delivered file in its default app. */
  onOpenFile?: () => void;
  /** Opens the PR in place (a sheet), else in a new tab. */
  onOpenPr?: (url: string) => void;
}

/**
 * The info message under the Summary: what the run left behind — the PR (link), the delivered
 * file (path + open) or its folder (path + open). A PR the coder opened itself with `gh pr create`
 * has no `prOutput`, so {@link useRunPrUrl} digs it out of the output.
 */
export function RunArtifactInfo({
  run,
  done,
  onOpenFolder,
  onOpenFile,
  onOpenPr,
}: RunArtifactInfoProps) {
  const t = useTranslations("runs.detail.artifact");
  const prUrl = useRunPrUrl(run, done);
  if (!done) return null;

  let body: { label: string; text: string; copy?: boolean; action?: [string, () => void] } | null =
    null;
  if (prUrl) {
    body = {
      label: t("pr"),
      text: prUrl.replace(/^https?:\/\//, ""),
      action: [
        t("openPr"),
        () => (onOpenPr ? onOpenPr(prUrl) : window.open(prUrl, "_blank", "noopener,noreferrer")),
      ],
    };
  } else if (
    run.kind === "workflow" &&
    runOutputKind(run) === "markdown" &&
    run.outputArtifactName
  ) {
    body = {
      label: t("file"),
      text: run.outputArtifactName,
      copy: true,
      ...(onOpenFile && { action: [t("openFile"), onOpenFile] as [string, () => void] }),
    };
  } else if (run.kind === "workflow" && run.folderPath) {
    body = {
      label: t("folder"),
      text: run.folderPath,
      copy: true,
      ...(onOpenFolder && { action: [t("openFolder"), onOpenFolder] as [string, () => void] }),
    };
  }
  if (!body) return null;

  return (
    <Alert data-testid={RunArtifactInfoTestId.Root}>
      <Stack wrap align="center" direction="row" gap="100" justify="between">
        <Stack wrap align="center" direction="row" gap="100">
          <Typography as="span" type="labelSm">
            {body.label}
          </Typography>
          <span data-testid={RunArtifactInfoTestId.Path}>
            {body.copy ? (
              <CopyableText copyLabel={t("copyPath")} text={body.text} />
            ) : (
              <Typography mono as="span" size="xs" type="note">
                {body.text}
              </Typography>
            )}
          </span>
        </Stack>
        {body.action && (
          <Button
            data-testid={RunArtifactInfoTestId.Open}
            intent="secondary"
            onClick={body.action[1]}
            size="sm"
          >
            {body.action[0]}
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
