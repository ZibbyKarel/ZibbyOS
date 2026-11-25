"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Alert,
  Button,
  Grid,
  IconTile,
  Panel,
  Pressable,
  Row,
  Sheet,
  Stack,
  StatusDot,
  Typography,
} from "@zibby/design-system";
import type { IntegrationKind } from "@zibby/contracts";
import { slug } from "../../../utils/slug";
import { useEntityT } from "../../entity/useEntityT";
import {
  useCreateIntegrationMutation,
  useIntegrationsQuery,
  useSetCredentialsMutation,
  useTestIntegrationMutation,
} from "..";
import { INTEGRATION_ACCENT, INTEGRATION_KIND_LABEL_KEY, sourceIcon } from "../kindIcon";
import {
  IntegrationFormFields,
  type IntegrationOwner,
  useIntegrationFormState,
} from "./IntegrationFormFields";

export enum ConnectWizardTestId {
  Root = "connect-wizard",
  Service = "connect-wizard-service",
  Next = "connect-wizard-next",
  Back = "connect-wizard-back",
  Done = "connect-wizard-done",
  Test = "connect-wizard-test",
  Retest = "connect-wizard-retest",
  Error = "connect-wizard-error",
}

const KINDS: IntegrationKind[] = [
  "jira",
  "github",
  "gitlab",
  "slack",
  "email",
  "calendar",
  "sentry",
];

export interface ConnectWizardSheetProps {
  /** `{ companyId }` for a company account, `{}` for the operator's personal account. */
  owner: IntegrationOwner;
  /** Display name of the company ("Acme Logistics"); unused for a personal account. */
  ownerName?: string;
  /** Company account: how many projects will be served by it. */
  inheritingCount?: number;
  onClose: () => void;
  /** Open the new integration's settings page (after a failed test). */
  onOpenIntegration: (id: string) => void;
}

type TestState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; ok: boolean; detail: string };

/**
 * The connect wizard side sheet: 1 pick a service, 2 fill the per-service form, 3 test the
 * connection. Keeps today's create order: create the integration,
 * store its secret, then run the existing pass/fail test.
 */
export function ConnectWizardSheet({
  owner,
  ownerName,
  inheritingCount = 0,
  onClose,
  onOpenIntegration,
}: ConnectWizardSheetProps) {
  const t = useEntityT();
  const tk = useTranslations();
  const form = useIntegrationFormState(owner);
  const integrationsQ = useIntegrationsQuery();
  const create = useCreateIntegrationMutation();
  const setCredentials = useSetCredentialsMutation();
  const test = useTestIntegrationMutation();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestState>({ phase: "idle" });
  const [busy, setBusy] = useState(false);

  const existing = new Set((integrationsQ.data ?? []).map((i) => i.id));
  const uniqueId = (kind: IntegrationKind) => {
    const base = slug(`${owner.companyId ?? "personal"}-${kind}`, {
      fallback: kind,
      maxLength: 60,
    });
    let id = base;
    for (let n = 2; existing.has(id); n++) id = `${base}-${n}`;
    return id;
  };

  const pick = (kind: IntegrationKind) => {
    form.setKind(kind);
    form.setId(uniqueId(kind));
    setStep(2);
  };

  const runTest = async (id: string) => {
    setResult({ phase: "running" });
    try {
      const res = await test.mutateAsync({ params: { id }, body: {} });
      setResult({ phase: "done", ok: res.body.ok, detail: res.body.detail });
    } catch {
      setResult({ phase: "done", ok: false, detail: tk("integrations.testFailed") });
    }
  };

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      let id = createdId;
      if (!id) {
        const body = form.buildCreate();
        await create.mutateAsync({ body });
        id = body.id;
        setCreatedId(id);
      }
      const secret = form.newSecret();
      if (secret) {
        await setCredentials.mutateAsync({
          params: { id },
          body: form.kind === "email" ? { password: secret } : { token: secret },
        });
      }
      setStep(3);
      void runTest(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("wizard.createFailed"));
    } finally {
      setBusy(false);
    }
  };

  const kindName = tk(INTEGRATION_KIND_LABEL_KEY[form.kind]);
  const stepLabels = [t("wizard.stepPick"), t("wizard.stepConnect"), t("wizard.stepTest")];

  const footer = (
    <Row gap="100" justify="between">
      <span>
        {step === 2 && !createdId && (
          <Button
            data-testid={ConnectWizardTestId.Back}
            icon="chevron"
            intent="ghost"
            onClick={() => setStep(1)}
          >
            {t("wizard.back")}
          </Button>
        )}
      </span>
      <Row gap="100">
        {step === 1 && (
          <Button intent="ghost" onClick={onClose}>
            {tk("common.cancel")}
          </Button>
        )}
        {step === 2 && (
          <Button
            data-testid={ConnectWizardTestId.Next}
            disabled={!form.canSave(true) || busy}
            icon="plug"
            intent="primary"
            loading={busy}
            onClick={() => void connect()}
          >
            {t("wizard.connect", { service: kindName })}
          </Button>
        )}
        {step === 3 && (
          <>
            {result.phase === "done" && !result.ok && createdId && (
              <Button intent="ghost" onClick={() => onOpenIntegration(createdId)}>
                {t("wizard.openSettings")}
              </Button>
            )}
            <Button data-testid={ConnectWizardTestId.Done} intent="primary" onClick={onClose}>
              {t("wizard.done")}
            </Button>
          </>
        )}
      </Row>
    </Row>
  );

  return (
    <Sheet
      open
      ariaLabel={t("wizard.title")}
      closeLabel={tk("common.close")}
      footer={footer}
      onClose={onClose}
      title={step === 1 ? t("wizard.title") : t("wizard.titleFor", { service: kindName })}
      width="xl"
    >
      <Stack data-testid={ConnectWizardTestId.Root} gap="250">
        <Stack gap="100">
          <Row align="center" gap="100">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              return (
                <Row align="center" gap="75" key={label}>
                  <StatusDot
                    size="100"
                    tone={n < step ? "done" : n === step ? "blocked" : "idle"}
                  />
                  <Typography size="sm" type="note" variant={n === step ? "primary" : "tertiary"}>
                    {n} · {label}
                  </Typography>
                </Row>
              );
            })}
          </Row>
          <Typography size="sm" type="note" variant="secondary">
            {owner.companyId
              ? t("wizard.contextCompany", {
                  name: ownerName ?? owner.companyId,
                  count: inheritingCount,
                })
              : t("wizard.contextPersonal")}
          </Typography>
        </Stack>

        {step === 1 && (
          <Grid cols={1} gap="100" md={2}>
            {KINDS.map((kind) => {
              const icon = sourceIcon(kind);
              return (
                <Pressable
                  data-testid={`${ConnectWizardTestId.Service}-${kind}`}
                  key={kind}
                  onClick={() => pick(kind)}
                >
                  <Panel padding="150" tone={undefined}>
                    <Row align="start" gap="150">
                      <IconTile
                        alt=""
                        color={INTEGRATION_ACCENT[kind]}
                        glyph={icon.glyph}
                        size="lg"
                        src={icon.src}
                      />
                      <Stack gap="50">
                        <Typography type="h3">{tk(INTEGRATION_KIND_LABEL_KEY[kind])}</Typography>
                        <Typography size="sm" type="note" variant="secondary">
                          {t(`wizard.kind.${kind}.desc`)}
                        </Typography>
                        <Typography size="xs" type="note" variant="tertiary">
                          {t("wizard.need")}: {t(`wizard.kind.${kind}.need`)}
                        </Typography>
                      </Stack>
                    </Row>
                  </Panel>
                </Pressable>
              );
            })}
          </Grid>
        )}

        {step === 2 && (
          <Stack gap="200">
            <Panel padding="150">
              <Stack gap="50">
                <Typography size="sm" type="h3">
                  {t("wizard.need")}
                </Typography>
                <Typography size="sm" type="note" variant="secondary">
                  {t(`wizard.kind.${form.kind}.need`)}
                </Typography>
              </Stack>
            </Panel>
            {error && (
              <Alert data-testid={ConnectWizardTestId.Error} severity="error">
                {error}
              </Alert>
            )}
            <IntegrationFormFields hideKind form={form} />
          </Stack>
        )}

        {step === 3 && (
          <Panel
            data-testid={ConnectWizardTestId.Test}
            header={
              <Row align="center" gap="100">
                <StatusDot
                  pulse={result.phase === "running"}
                  size="100"
                  tone={
                    result.phase === "running"
                      ? "working"
                      : result.phase === "done" && result.ok
                        ? "done"
                        : result.phase === "done"
                          ? "error"
                          : "idle"
                  }
                />
                <Typography type="h3">
                  {result.phase === "running"
                    ? t("wizard.testing")
                    : result.phase === "done" && result.ok
                      ? t("wizard.testOk")
                      : t("wizard.testFail")}
                </Typography>
              </Row>
            }
            headerEnd={
              result.phase === "done" && (
                <Button
                  data-testid={ConnectWizardTestId.Retest}
                  icon="refresh"
                  intent="ghost"
                  onClick={() => createdId && void runTest(createdId)}
                  size="sm"
                >
                  {t("wizard.retest")}
                </Button>
              )
            }
            padding="200"
          >
            <Stack gap="100">
              {result.phase === "done" && (
                <Typography mono size="sm" type="note" variant="secondary">
                  {result.detail}
                </Typography>
              )}
              {result.phase === "done" && result.ok && (
                <Typography size="sm" type="note" variant="secondary">
                  {owner.companyId
                    ? t("wizard.doneCompany", { count: inheritingCount })
                    : t("wizard.donePersonal")}
                </Typography>
              )}
              {result.phase === "done" && !result.ok && (
                <Typography size="sm" type="note" variant="secondary">
                  {t("wizard.failHint")}
                </Typography>
              )}
            </Stack>
          </Panel>
        )}
      </Stack>
    </Sheet>
  );
}
