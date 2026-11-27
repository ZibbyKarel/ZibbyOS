"use client";

import type { ChatWidget } from "@zibby/contracts";
import { Button, Card, Container, Icon, Stack, TextLink, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { useOptionalChat } from "../../chat/ChatContext";
import { getDesktopWeb } from "../../web/desktopWeb";

export enum WebWidgetCardTestId {
  Root = "web-widget-card",
  Open = "web-widget-card-open",
  Link = "web-widget-card-link",
}

export interface WebWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "web" }>;
}

/**
 * `web` — a page the agent wants to show. In the desktop app the button opens it in the side
 * panel's browser; anywhere else (browser, phone) it is a link to the system browser.
 */
export function WebWidgetCard({ widget }: WebWidgetCardProps) {
  const t = useTranslations("zibby.web.card");
  const phone = useIsPhone();
  const chat = useOptionalChat();
  const inPanel = !phone && chat !== null && getDesktopWeb() !== null;
  const host = new URL(widget.url).host;
  const title = widget.title ?? host;
  return (
    <Card background="raised" data-testid={WebWidgetCardTestId.Root} radius="lg">
      <Container padding={["100", "150"]}>
        <Stack align="center" direction="row" gap="100">
          <Icon name="globe" size="sm" />
          <Container grow minW0>
            <Typography truncate size="sm" type="note" weight="semibold">
              {title}
            </Typography>
            <Typography truncate size="xs" type="note" variant="tertiary">
              {widget.url}
            </Typography>
          </Container>
          {inPanel ? (
            <Button
              data-testid={WebWidgetCardTestId.Open}
              intent="secondary"
              onClick={() => chat.openWeb({ url: widget.url, title: widget.title })}
              size="sm"
            >
              {t("open")}
            </Button>
          ) : (
            <TextLink
              data-testid={WebWidgetCardTestId.Link}
              href={widget.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Typography size="sm" type="note">
                {t("openInBrowser")}
              </Typography>
            </TextLink>
          )}
        </Stack>
      </Container>
    </Card>
  );
}
