"use client";

import type { InboxPr } from "@zibby/contracts";
import {
  Container,
  MenuSurface,
  Pressable,
  Row,
  Stack,
  Tag,
  TextLink,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export enum PrChecksHoverTestId {
  Trigger = "pr-checks-hover-trigger",
  Panel = "pr-checks-hover-panel",
  Job = "pr-checks-hover-job",
  JobLink = "pr-checks-hover-job-link",
}

export interface PrChecksHoverProps {
  jobs: NonNullable<InboxPr["ciFailingJobs"]>;
  children: ReactNode;
}

const GAP = 6;
const MARGIN = 8;
const WIDTH = 320;
/** Lets the pointer cross the gap between the trigger and the panel (links stay clickable). */
const CLOSE_DELAY_MS = 150;

/**
 * Wraps the Checks value: hover / focus / click opens a small portaled panel under it listing
 * the failed jobs (name, status, link to the job). Portaled `fixed` because the summary strip
 * clips overflow — same approach as `HeaderPopover`. Without jobs it renders the children bare.
 */
export function PrChecksHover({ jobs, children }: PrChecksHoverProps) {
  const t = useTranslations("bridge.sheet.pr.failedJobs");
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(() => {
    clearTimeout(timer.current);
    if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (jobs.length === 0) return <>{children}</>;

  const w = Math.min(
    WIDTH,
    (typeof window === "undefined" ? WIDTH : window.innerWidth) - 2 * MARGIN,
  );
  return (
    <>
      <span onBlur={hide} onFocus={show} onMouseEnter={show} onMouseLeave={hide} ref={anchorRef}>
        <Pressable
          aria-expanded={open}
          aria-haspopup="dialog"
          data-testid={PrChecksHoverTestId.Trigger}
          onClick={() => (open ? setOpen(false) : show())}
        >
          {children}
        </Pressable>
      </span>
      {open &&
        rect &&
        createPortal(
          <MenuSurface
            aria-label={t("title")}
            data-testid={PrChecksHoverTestId.Panel}
            onBlur={hide}
            onFocus={show}
            onMouseEnter={show}
            onMouseLeave={hide}
            placement="fixed"
            role="dialog"
            style={{
              top: rect.bottom + GAP,
              left: Math.max(MARGIN, Math.min(rect.left, window.innerWidth - w - MARGIN)),
              width: w,
              zIndex: 60,
            }}
          >
            <Container padding="150">
              <Stack gap="100">
                <Typography type="labelSm">{t("title")}</Typography>
                {jobs.map((job) => (
                  <Row
                    align="center"
                    data-testid={PrChecksHoverTestId.Job}
                    gap="100"
                    justify="between"
                    key={job.name}
                  >
                    <Typography as="span" type="code">
                      {job.name}
                    </Typography>
                    <Row align="center" gap="100">
                      <Tag tone="error">{t(`status.${statusKey(job.status)}`)}</Tag>
                      {job.url ? (
                        <TextLink
                          aria-label={t("open", { name: job.name })}
                          data-testid={PrChecksHoverTestId.JobLink}
                          href={job.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          ↗
                        </TextLink>
                      ) : null}
                    </Row>
                  </Row>
                ))}
              </Stack>
            </Container>
          </MenuSurface>,
          document.body,
        )}
    </>
  );
}

const STATUS_KEYS = ["failure", "cancelled", "timed_out"] as const;
function statusKey(status: string): (typeof STATUS_KEYS)[number] {
  return STATUS_KEYS.find((k) => k === status) ?? "failure";
}
