"use client";

import { Panel, Stack, Typography } from "@zibby/design-system";
import type { TeamKbDigestItem } from "@zibby/contracts";
import type { EntityT } from "../../entity/useEntityT";

export enum TeamKbFeedTestId {
  Root = "team-kb-feed",
  Item = "team-kb-feed-item",
}

export interface TeamKbFeedProps {
  items: TeamKbDigestItem[];
  t: EntityT;
}

/** "Recently updated knowledge": the newest agreements and open questions of the team KB digest. Hidden when empty. */
export function TeamKbFeed({ items, t }: TeamKbFeedProps) {
  if (items.length === 0) return null;
  return (
    <Panel
      headerRule
      data-testid={TeamKbFeedTestId.Root}
      header={<Typography type="h3">{t("team.feed.title")}</Typography>}
      padding="200"
    >
      <Stack gap="150">
        {items.map((it, i) => (
          <Stack data-testid={TeamKbFeedTestId.Item} gap="25" key={`${it.noteId}-${i}`}>
            <Typography size="sm" type="note">
              {it.noteTitle}
              {it.date ? ` · ${it.date}` : ""}
            </Typography>
            <Typography size="xs" type="note" variant="tertiary">
              {it.text}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Panel>
  );
}
