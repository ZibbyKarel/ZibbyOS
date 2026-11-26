"use client";

import type { ConnectedService } from "@zibby/contracts";
import { Button, Dialog, Stack } from "@zibby/design-system";
import { FormTextInput, useFormControls, zodResolver } from "@zibby/forms";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { useCreateConnectedServiceMutation, useUpdateConnectedServiceMutation } from "../mutations";

export enum ConnectedServiceDialogTestId {
  Name = "connected-service-dialog-name",
  LoginUrl = "connected-service-dialog-login-url",
  IconUrl = "connected-service-dialog-icon-url",
  Submit = "connected-service-dialog-submit",
}

const FormSchema = z.object({
  name: z.string().trim().min(1),
  loginUrl: z.string().url(),
  iconUrl: z.union([z.literal(""), z.string().url()]),
});
type FormValues = z.infer<typeof FormSchema>;

export interface ConnectedServiceDialogProps {
  /** The service to edit; absent = add a new one. */
  service?: ConnectedService;
  onClose: () => void;
}

/** Add or edit a connected service: name, login URL and an optional icon URL (empty = favicon). */
export function ConnectedServiceDialog({ service, onClose }: ConnectedServiceDialogProps) {
  const t = useTranslations("settings.accounts.serviceDialog");
  const tc = useTranslations("common");
  const create = useCreateConnectedServiceMutation();
  const update = useUpdateConnectedServiceMutation();
  const pending = create.isPending || update.isPending;
  const { renderForm, submit } = useFormControls<FormValues>({
    defaultValues: {
      name: service?.name ?? "",
      loginUrl: service?.loginUrl ?? "",
      iconUrl: service?.iconUrl ?? "",
    },
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    onSubmit: ({ name, loginUrl, iconUrl }) => {
      if (pending) return;
      if (service) {
        update.mutate(
          { params: { id: service.id }, body: { name, loginUrl, iconUrl: iconUrl || null } },
          { onSuccess: onClose },
        );
      } else {
        create.mutate(
          { body: { name, loginUrl, iconUrl: iconUrl || undefined } },
          { onSuccess: onClose },
        );
      }
    },
  });
  const title = service ? t("editTitle") : t("addTitle");
  const failed = create.error ?? update.error;

  return renderForm(
    <Dialog
      open
      actions={
        <>
          <Button intent="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            data-testid={ConnectedServiceDialogTestId.Submit}
            icon="check"
            intent="primary"
            loading={pending}
            onClick={() => void submit()}
          >
            {service ? t("save") : t("add")}
          </Button>
        </>
      }
      ariaLabel={title}
      closeLabel={tc("close")}
      onClose={onClose}
      title={title}
      width="sm"
    >
      <Stack gap="200">
        <FormTextInput<FormValues>
          autoFocus
          data-testid={ConnectedServiceDialogTestId.Name}
          error={
            failed
              ? t("status" in failed && failed.status === 409 ? "exists" : "failed")
              : undefined
          }
          label={t("name")}
          name="name"
        />
        <FormTextInput<FormValues>
          data-testid={ConnectedServiceDialogTestId.LoginUrl}
          label={t("loginUrl")}
          name="loginUrl"
          placeholder="https://"
        />
        <FormTextInput<FormValues>
          data-testid={ConnectedServiceDialogTestId.IconUrl}
          label={t("iconUrl")}
          name="iconUrl"
          placeholder={t("iconPlaceholder")}
        />
      </Stack>
    </Dialog>,
  );
}
