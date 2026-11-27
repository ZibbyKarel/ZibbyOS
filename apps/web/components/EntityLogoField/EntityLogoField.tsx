"use client";

import { useTranslations } from "next-intl";
import { LogoUpload } from "@zibby/design-system";
import { LOGO_MAX_BYTES } from "@zibby/contracts";
import { toastBus } from "../Toaster/toastBus";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export interface EntityLogoFieldProps {
  /** Current logo data URI / path. */
  value?: string;
  /** Entity name — alt text. */
  name?: string;
  /** Placeholder (initials) shown without a logo. */
  fallback: string;
  /** Picked logo as a data URI, or `undefined` when removed. */
  onChange: (logo: string | undefined) => void;
}

/**
 * Logo editor shared by the company, team and project edit panels: hover (or focus)
 * the logo to change it. Checks type/size client-side for a friendly message; the
 * API re-validates by content (`LogoInputSchema`).
 */
export function EntityLogoField({ value, name, fallback, onChange }: EntityLogoFieldProps) {
  const t = useTranslations("logo");

  function handleSelect(file: File) {
    if (!ALLOWED_TYPES.has(file.type) || file.size > LOGO_MAX_BYTES) {
      toastBus.emit({ message: t("invalid") });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
      else toastBus.emit({ message: t("invalid") });
    };
    reader.readAsDataURL(file);
  }

  return (
    <LogoUpload
      alt={name}
      changeLabel={t("change")}
      fallback={fallback}
      onRemove={() => onChange(undefined)}
      onSelect={handleSelect}
      removeLabel={t("remove")}
      src={value}
    />
  );
}
