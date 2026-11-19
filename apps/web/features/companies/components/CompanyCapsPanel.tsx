"use client";

import { Button, Grid, Meter, Panel, Stack, Typography } from "@zibby/design-system";
import { type CompanyUsage, pctOf } from "../companyUsage";
import type { EntityT } from "../../entity/useEntityT";

export enum CompanyCapsPanelTestId {
  Root = "company-caps-panel",
  Edit = "company-caps-edit",
}

export interface CompanyCapsPanelProps {
  usage: CompanyUsage;
  t: EntityT;
  onEdit: () => void;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US").replace(/,/g, " ")}`;

/** Daily / weekly / monthly caps with live usage (design "Budget caps"); lower levels may only tighten. */
export function CompanyCapsPanel({ usage, t, onEdit }: CompanyCapsPanelProps) {
  return (
    <Panel
      headerRule
      data-testid={CompanyCapsPanelTestId.Root}
      header={<Typography type="h3">{t("company.caps.title")}</Typography>}
      headerEnd={
        <Button
          aria-label={t("company.caps.edit")}
          data-testid={CompanyCapsPanelTestId.Edit}
          icon="edit"
          intent="ghost"
          onClick={onEdit}
          size="sm"
        />
      }
      padding="200"
    >
      <Stack gap="150">
        <Grid align="center" cols={3} gap="100">
          <span />
          <Typography size="xs" type="note" variant="tertiary">
            {t("company.caps.runs")}
          </Typography>
          <Typography size="xs" type="note" variant="tertiary">
            {t("company.caps.spend")}
          </Typography>
          {usage.rows.map((r) => (
            <CapRowCells key={r.window} row={r} t={t} />
          ))}
        </Grid>
        <Typography size="xs" type="note" variant="tertiary">
          {t("company.caps.note")}
        </Typography>
      </Stack>
    </Panel>
  );
}

function CapRowCells({ row, t }: { row: CompanyUsage["rows"][number]; t: EntityT }) {
  return (
    <>
      <Typography size="sm" type="note" variant="secondary">
        {t(`company.caps.${row.window}`)}
      </Typography>
      <Meter
        quiet
        label=""
        pct={pctOf(row.runsUsed, row.runsCap)}
        value={row.runsCap ? `${row.runsUsed} / ${row.runsCap}` : String(row.runsUsed)}
      />
      <Meter
        quiet
        label=""
        pct={pctOf(row.spendUsed, row.spendCap)}
        value={row.spendCap ? `${usd(row.spendUsed)} / ${usd(row.spendCap)}` : usd(row.spendUsed)}
      />
    </>
  );
}

export { usd as formatUsd };
