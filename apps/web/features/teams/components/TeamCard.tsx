import type { Team } from "@zibby/contracts";
import { IconTile, ListCard, Stack, Tag, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";

export interface TeamCardProps {
  team: Team;
  /** Display name of the owning company (the crumb chip); omitted for a company-less team. */
  companyName?: string;
  onOpen?: (team: Team) => void;
}

/**
 * Catalog card for a team (design Seznamy "Týmy"): company crumb chip, name + mono slug,
 * clamped description and the app-only "has knowledge base" tag. The members row and the
 * KB freshness block of the design are left out (no members data / no cheap note count).
 */
export function TeamCard({ team, companyName, onOpen }: TeamCardProps) {
  const t = useTranslations("teams");
  const hasKnowledgeBase = team.knowledgeBase != null;

  return (
    <ListCard onOpen={() => onOpen?.(team)} openLabel={t("openAria", { name: team.name })}>
      {team.logo && (
        <Stack direction="row">
          <IconTile alt="" glyph="users" size="lg" src={team.logo} />
        </Stack>
      )}
      {companyName && (
        <Stack direction="row">
          <Tag icon="building" tone="neutral">
            {companyName}
          </Tag>
        </Stack>
      )}
      <Stack gap="50">
        <Stack wrap align="baseline" direction="row" gap="100">
          <Typography size="lg" type="note" weight="semibold">
            {team.name}
          </Typography>
          <Typography mono size="caption" type="note" variant="tertiary">
            {team.slug ?? team.id}
          </Typography>
        </Stack>
        {team.desc && (
          <Typography leading="snug" size="sm" type="note" variant="secondary">
            {team.desc}
          </Typography>
        )}
      </Stack>
      {hasKnowledgeBase && (
        <Stack direction="row">
          <Tag icon="book" tone="accent">
            {t("hasKnowledgeBase")}
          </Tag>
        </Stack>
      )}
    </ListCard>
  );
}
