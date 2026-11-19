import type { Company } from "@zibby/contracts";
import {
  AvatarStack,
  CodeTile,
  Divider,
  ListCard,
  MiniTree,
  SemiGauge,
  Stack,
  Tag,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { formatCostUsd } from "../../../utils/cost";
import type { CompanySummary } from "../companySummary";

export interface CompanyCardProps {
  company: Company;
  summary: CompanySummary;
  onOpen?: (company: Company) => void;
}

function monogram(name: string): string {
  const words = name.trim().split(/\s+/);
  const letters =
    words.length > 1 ? (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "") : name.trim().slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Large catalog card for a company (design Seznamy "Firmy"): monogram, name + slug,
 * people avatar stack, description, mini tree team -> project squares with the
 * budget gauge, and a footer with the counts and the default daily budget.
 */
export function CompanyCard({ company, summary, onOpen }: CompanyCardProps) {
  const t = useTranslations("companies");
  const people = company.people ?? [];
  const cap = company.budget?.dailyCostCapUsd;
  const { gauge } = summary;

  return (
    <ListCard onOpen={() => onOpen?.(company)} openLabel={t("openAria", { name: company.name })}>
      <Stack align="center" direction="row" gap="200">
        <CodeTile solid code={monogram(company.name)} />
        <Stack grow gap="25">
          <Typography truncate size="xl" type="note" weight="semibold">
            {company.name}
          </Typography>
          <Typography mono truncate size="caption" type="note" variant="tertiary">
            {company.id}
          </Typography>
        </Stack>
        {people.length > 0 && (
          <AvatarStack items={people} label={t("peopleCount", { count: people.length })} />
        )}
      </Stack>
      {company.desc && (
        <Typography leading="relaxed" size="base" type="note" variant="secondary">
          {company.desc}
        </Typography>
      )}
      {(summary.teams.length > 0 || gauge) && (
        <>
          <Divider />
          <Stack align="center" direction="row" gap="300" justify="between">
            <Stack grow>
              {summary.teams.length > 0 && (
                <MiniTree
                  root={{ label: company.id, icon: "users" }}
                  rows={summary.teams.map((tm) => ({
                    id: tm.id,
                    label: tm.name,
                    icon: "grid",
                    squares: tm.projectCount,
                    caption: t("projectsCount", { count: tm.projectCount }),
                  }))}
                />
              )}
            </Stack>
            {gauge && (
              <SemiGauge
                ariaLabel={t("gaugeAria", { name: company.name })}
                caption={t("gaugeCaption", {
                  spent: formatCostUsd(gauge.spentUsd),
                  cap: formatCostUsd(gauge.capUsd),
                })}
                pct={gauge.pct}
              />
            )}
          </Stack>
        </>
      )}
      <Divider />
      <Stack wrap align="center" direction="row" gap="150" justify="between">
        <Typography size="caption" type="note" variant="tertiary">
          {t("teamsCount", { count: summary.teams.length })} ·{" "}
          {t("projectsCount", { count: summary.projectCount })}
        </Typography>
        {cap != null && (
          <Typography size="caption" type="note" variant="tertiary">
            {t("defaultBudget")}{" "}
            <Typography as="span" size="caption" type="note" weight="semibold">
              {t("perDay", { amount: formatCostUsd(cap) })}
            </Typography>
          </Typography>
        )}
        {cap == null && company.budget != null && <Tag tone="accent">{t("hasBudget")}</Tag>}
      </Stack>
    </ListCard>
  );
}
