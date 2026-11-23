"use client";

import { Button, CanvasPanel, type CanvasPanelStatus } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { canvasUrls } from "../canvas/canvasUrl";
import { type CanvasKeyPayload, useCanvasBridge } from "../canvas/useCanvasBridge";
import { type OpenCanvas, useChat } from "../chat/ChatContext";

const SANDBOX = "allow-scripts allow-pointer-lock allow-modals";
const STATUSES = [
  "loading",
  "ready",
  "error",
  "unresponsive",
] as const satisfies readonly CanvasPanelStatus[];

export interface ZibbyCanvasPanelProps {
  canvas: OpenCanvas;
  /** A ZibbyOS shortcut pressed inside the page (`z:key`) — same handlers as the window's. */
  onKey: (key: CanvasKeyPayload) => void;
}

/** The side panel of the overlay: the canvas iframe, its bridge and the panel actions. */
export function ZibbyCanvasPanel({ canvas, onKey }: ZibbyCanvasPanelProps) {
  const t = useTranslations("zibby.canvas.panel");
  const { canvasMode, setCanvasMode, closeCanvas } = useChat();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { frame, external, isolated } = canvasUrls(canvas.id, canvas.version);
  const { status, errors, reload } = useCanvasBridge({
    frameRef,
    src: frame ?? "",
    onKey,
    confirmOpenUrl: (url) => t("confirmOpenUrl", { url }),
  });
  if (!frame) return null;

  const first = errors[0];
  const message =
    status === "unresponsive"
      ? t("unresponsiveMessage")
      : first
        ? t("pageError", { message: first.message })
        : t("loadFailed");
  const full = canvasMode === "full";
  return (
    <CanvasPanel
      actions={
        <Button intent="secondary" onClick={reload} size="sm">
          {t("reload")}
        </Button>
      }
      allow="fullscreen; clipboard-write"
      backLabel={t("back")}
      closeLabel={t("close")}
      errorCount={errors.length}
      errorsLabel={(count) => t("errors", { count })}
      frameRef={frameRef}
      frameTitle={t("frameTitle", { title: canvas.title })}
      full={full}
      fullLabel={t("full")}
      message={message}
      onClose={closeCanvas}
      onOpenExternal={() => {
        if (external) window.open(external, "_blank", "noopener,noreferrer");
      }}
      onReload={reload}
      onToggleFull={() => setCanvasMode(full ? "split" : "full")}
      openExternalLabel={t("openExternal")}
      reloadLabel={t("reload")}
      sandbox={isolated ? `${SANDBOX} allow-same-origin` : SANDBOX}
      src={frame}
      status={status}
      statusLabels={Object.fromEntries(STATUSES.map((s) => [s, t(`status.${s}`)]))}
      title={canvas.title}
      version={canvas.version}
    />
  );
}
