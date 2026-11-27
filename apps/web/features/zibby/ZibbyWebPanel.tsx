"use client";

import { Button, Container, Stack, TextInputField, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { type DesktopWebBridge, type DesktopWebState } from "../web/desktopWeb";
import { normalizeWebUrl } from "../web/webUrl";
import type { OpenWeb } from "../chat/ChatContext";

export enum ZibbyWebPanelTestId {
  Root = "zibby-web-panel",
  Back = "zibby-web-panel-back",
  Reload = "zibby-web-panel-reload",
  Address = "zibby-web-panel-address",
  OpenExternal = "zibby-web-panel-open-external",
  Expand = "zibby-web-panel-expand",
  Close = "zibby-web-panel-close",
  Slot = "zibby-web-panel-slot",
}

export interface ZibbyWebPanelProps {
  page: OpenWeb;
  desktop: DesktopWebBridge;
  full: boolean;
  onToggleFull: () => void;
  onClose: () => void;
}

/**
 * The side panel's browser: a toolbar plus an empty slot. The Electron WebContentsView is laid
 * over the slot by the main process, which only knows the rectangle this reports.
 */
export function ZibbyWebPanel({ page, desktop, full, onToggleFull, onClose }: ZibbyWebPanelProps) {
  const t = useTranslations("zibby.web.panel");
  const slotRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<DesktopWebState>({
    url: page.url,
    title: page.title ?? "",
    canGoBack: false,
    loading: true,
  });
  /** What the operator is typing; null = the field shows the page's own url. */
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => desktop.onState(setState), [desktop]);
  useEffect(() => {
    desktop.open(page.url);
    return () => desktop.hide();
  }, [desktop, page.url]);

  // ponytail: a rAF poll instead of resize/scroll/transition listeners — the overlay animates and
  // the splitter drags, and only a changed rect is sent. Swap for a ResizeObserver if it shows up in a profile.
  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      const r = slotRef.current?.getBoundingClientRect();
      if (r) {
        const key = `${r.x},${r.y},${r.width},${r.height}`;
        if (key !== last) {
          last = key;
          desktop.setBounds({ x: r.x, y: r.y, width: r.width, height: r.height });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [desktop]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const url = normalizeWebUrl(draft ?? state.url);
    setInvalid(!url);
    if (url) {
      setDraft(null);
      desktop.go(url);
    }
  };

  return (
    <Container data-testid={ZibbyWebPanelTestId.Root} height="100%">
      <Stack direction="col" gap="0">
        <Container padding={["75", "100"]}>
          <Stack align="center" direction="row" gap="75">
            <Button
              data-testid={ZibbyWebPanelTestId.Back}
              disabled={!state.canGoBack}
              intent="ghost"
              onClick={desktop.back}
              size="sm"
            >
              {t("back")}
            </Button>
            <Button
              aria-label={t("reload")}
              data-testid={ZibbyWebPanelTestId.Reload}
              icon="retry"
              intent="ghost"
              loading={state.loading}
              onClick={desktop.reload}
              size="sm"
              title={t("reload")}
            />
            <Container grow minW0 as="form" onSubmit={onSubmit}>
              <TextInputField
                hideLabel
                data-testid={ZibbyWebPanelTestId.Address}
                error={invalid ? t("invalidUrl") : undefined}
                label={t("address")}
                onChange={(e) => setDraft(e.target.value)}
                size="sm"
                spellCheck={false}
                value={draft ?? state.url}
              />
            </Container>
            <Button
              aria-label={t("openExternal")}
              data-testid={ZibbyWebPanelTestId.OpenExternal}
              icon="link"
              intent="ghost"
              onClick={desktop.openExternal}
              size="sm"
              title={t("openExternal")}
            />
            <Button
              aria-label={full ? t("backToChat") : t("full")}
              data-testid={ZibbyWebPanelTestId.Expand}
              icon={full ? "arrow" : "expand"}
              intent="ghost"
              onClick={onToggleFull}
              size="sm"
              title={full ? t("backToChat") : t("full")}
            />
            <Button
              aria-label={t("close")}
              data-testid={ZibbyWebPanelTestId.Close}
              icon="x"
              intent="ghost"
              onClick={onClose}
              size="sm"
              title={t("close")}
            />
          </Stack>
        </Container>
        {state.title && (
          <Container padding={["0", "100", "50", "100"]}>
            <Typography truncate size="xs" type="note" variant="tertiary">
              {state.title}
            </Typography>
          </Container>
        )}
        <Container
          grow
          data-testid={ZibbyWebPanelTestId.Slot}
          minHeight="0"
          position="relative"
          ref={slotRef}
        />
      </Stack>
    </Container>
  );
}
