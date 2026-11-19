"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { onRunEvent } from "../../runs/runEvents";

/**
 * Every new approval pops a system notification, so the operator notices something waits on them
 * (an approval always waits for the operator, whatever the autonomy levels). Renders nothing.
 */
export function ApprovalNotifier() {
  const t = useTranslations("autopilot");
  const title = t("approvalNotificationTitle");

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") void Notification.requestPermission();
    return onRunEvent((event) => {
      if (event.scope !== "activity" || event.kind !== "approval-requested") return;
      if (Notification.permission !== "granted") return;
      const n = new Notification(title, {
        body: event.entry?.summary,
        tag: event.entry?.refs?.approvalId,
      });
      n.onclick = () => window.focus();
    });
  }, [title]);

  return null;
}
