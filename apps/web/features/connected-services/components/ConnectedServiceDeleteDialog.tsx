"use client";

import type { ConnectedService } from "@zibby/contracts";
import { Button, Dialog, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useDeleteConnectedServiceMutation } from "../mutations";

export enum ConnectedServiceDeleteDialogTestId {
  Confirm = "connected-service-delete-dialog-confirm",
}

export interface ConnectedServiceDeleteDialogProps {
  service: ConnectedService;
  onClose: () => void;
}

/** Confirms removing a service: its definition and generated MCP server go, the browser profile stays. */
export function ConnectedServiceDeleteDialog({
  service,
  onClose,
}: ConnectedServiceDeleteDialogProps) {
  const t = useTranslations("settings.accounts.deleteDialog");
  const tc = useTranslations("common");
  const del = useDeleteConnectedServiceMutation();
  const title = t("title", { name: service.name });

  return (
    <Dialog
      open
      actions={
        <>
          <Button intent="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            data-testid={ConnectedServiceDeleteDialogTestId.Confirm}
            icon="trash"
            intent="danger"
            loading={del.isPending}
            onClick={() => del.mutate({ params: { id: service.id } }, { onSuccess: onClose })}
          >
            {tc("delete")}
          </Button>
        </>
      }
      ariaLabel={title}
      closeLabel={tc("close")}
      onClose={onClose}
      title={title}
      width="sm"
    >
      <Typography type="text">{t("body", { profile: service.profile })}</Typography>
      {del.isError ? (
        <Typography tone="bad" type="note">
          {t("failed")}
        </Typography>
      ) : null}
    </Dialog>
  );
}
