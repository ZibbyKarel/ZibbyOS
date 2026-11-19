"use client";

import { useState } from "react";
import { Button, Stack, TextAreaField, TextInputField, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useCreateTeamKbNoteMutation } from "../../teams";

export enum KbInboxComposeTestId {
  Open = "kb-inbox-open",
  Title = "kb-inbox-title",
  Body = "kb-inbox-body",
  Save = "kb-inbox-save",
  Saved = "kb-inbox-saved",
}

export interface KbInboxComposeProps {
  teamId: string;
}

/**
 * A team KB is read-only: changes reach it through a PR, ZIBBY only ever writes a note into the
 * KB's `inbox/`. This is that one write path (`POST /teams/:id/kb/notes`) as an inline composer
 * under a KB note.
 */
export function KbInboxCompose({ teamId }: KbInboxComposeProps) {
  const t = useTranslations("knowledge.brain.inbox");
  const create = useCreateTeamKbNoteMutation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);

  if (!open)
    return (
      <Stack align="center" direction="row" gap="100">
        <Button
          data-testid={KbInboxComposeTestId.Open}
          icon="plus"
          intent="secondary"
          onClick={() => {
            setSaved(false);
            setOpen(true);
          }}
          size="sm"
        >
          {t("open")}
        </Button>
        {saved && (
          <Typography
            mono
            data-testid={KbInboxComposeTestId.Saved}
            role="status"
            size="2xs"
            type="note"
            variant="tertiary"
          >
            {t("saved")}
          </Typography>
        )}
      </Stack>
    );

  const canSave = title.trim().length > 0 && body.trim().length > 0;
  return (
    <Stack gap="100">
      <Typography mono size="2xs" type="note" variant="tertiary">
        {t("hint")}
      </Typography>
      <TextInputField
        data-testid={KbInboxComposeTestId.Title}
        label={t("titleLabel")}
        onChange={(e) => setTitle(e.target.value)}
        value={title}
      />
      <TextAreaField
        data-testid={KbInboxComposeTestId.Body}
        label={t("bodyLabel")}
        onChange={(e) => setBody(e.target.value)}
        value={body}
      />
      <Stack align="center" direction="row" gap="100">
        <Button intent="ghost" onClick={() => setOpen(false)} size="sm">
          {t("cancel")}
        </Button>
        <Button
          data-testid={KbInboxComposeTestId.Save}
          disabled={!canSave}
          icon="check"
          intent="primary"
          loading={create.isPending}
          onClick={() =>
            create.mutate(
              { params: { id: teamId }, body: { title: title.trim(), body: body.trim() } },
              {
                onSuccess: () => {
                  setTitle("");
                  setBody("");
                  setOpen(false);
                  setSaved(true);
                },
              },
            )
          }
          size="sm"
        >
          {t("save")}
        </Button>
      </Stack>
    </Stack>
  );
}
