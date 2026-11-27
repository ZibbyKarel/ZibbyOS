"use client";

import type { AuthCookie, ConnectedService } from "@zibby/contracts";
import { Button, Dialog, Stack } from "@zibby/design-system";
import { FormTextArea, FormTextInput, useFormControls, zodResolver } from "@zibby/forms";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { useCreateConnectedServiceMutation, useUpdateConnectedServiceMutation } from "../mutations";

export enum ConnectedServiceDialogTestId {
  Name = "connected-service-dialog-name",
  LoginUrl = "connected-service-dialog-login-url",
  IconUrl = "connected-service-dialog-icon-url",
  AuthCookies = "connected-service-dialog-auth-cookies",
  Submit = "connected-service-dialog-submit",
}

/** One cookie entry per line: `host: name1, name2`. Returns `null` when a line is malformed. */
export function parseAuthCookies(text: string): AuthCookie[] | null {
  const out: AuthCookie[] = [];
  for (const line of text.split("\n").filter((l) => l.trim())) {
    // A pasted URL ("https://host: name") must not split at the scheme's colon.
    const entry = line.replace(/^\s*[a-z][a-z0-9+.-]*:\/\//i, "");
    const i = entry.indexOf(":");
    const host = entry.slice(0, i).trim();
    const names = entry
      .slice(i + 1)
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (i < 0 || !host || host.includes("/") || !names.length) return null;
    out.push({ host, names });
  }
  return out;
}

const formatAuthCookies = (cookies: AuthCookie[] = []) =>
  cookies.map((c) => `${c.host}: ${c.names.join(", ")}`).join("\n");

const FormSchema = z.object({
  name: z.string().trim().min(1),
  loginUrl: z.string().url(),
  iconUrl: z.union([z.literal(""), z.string().url()]),
  authCookies: z.string().refine((v) => parseAuthCookies(v) !== null, "format"),
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
      authCookies: formatAuthCookies(service?.authCookies),
    },
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    onSubmit: ({ name, loginUrl, iconUrl, authCookies: cookieText }) => {
      if (pending) return;
      const authCookies = parseAuthCookies(cookieText) ?? [];
      if (service) {
        update.mutate(
          {
            params: { id: service.id },
            body: { name, loginUrl, iconUrl: iconUrl || null, authCookies },
          },
          { onSuccess: onClose },
        );
      } else {
        create.mutate(
          { body: { name, loginUrl, iconUrl: iconUrl || undefined, authCookies } },
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
        <FormTextArea<FormValues>
          data-testid={ConnectedServiceDialogTestId.AuthCookies}
          hint={t("authCookiesHint")}
          label={t("authCookies")}
          name="authCookies"
          placeholder=".example.com: session, token"
        />
      </Stack>
    </Dialog>,
  );
}
