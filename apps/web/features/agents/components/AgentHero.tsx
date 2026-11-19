"use client";

import { useTranslations } from "next-intl";
import { useDetailT } from "../useDetailT";
import Link from "next/link";
import {
  Button,
  Container,
  EngineBadge,
  type EngineBadgeProps,
  type IconName,
  IconTile,
  Kbd,
  Stack,
  type SubNavLinkComponent,
  Tag,
  TextLink,
  Typography,
} from "@zibby/design-system";
import { AgentDetailScreenTestId as TestId } from "../agentTestIds";

export interface AgentHeroProps {
  isNew: boolean;
  /** `displayName ?? name`, live from the form. */
  title: string;
  fileName: string;
  /** The job title ("Code reviewer"). */
  role?: string;
  department?: { id: string; name: string };
  glyph: string;
  avatar?: string;
  engineBadge: Required<Pick<EngineBadgeProps, "engine" | "label">>;
  /** The three chips: model tier, thinking, engine. */
  chips: { model: string; thinking: string; engine: string };
  dirty: boolean;
  saving: boolean;
  /** Create / Save is allowed (name present, no inline error). */
  canSubmit: boolean;
  onSubmit: () => void;
  onRun?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

/** The profile header: avatar with engine mark, name + file, role / department, three chips, actions. */
export function AgentHero({
  isNew,
  title,
  fileName,
  role,
  department,
  glyph,
  avatar,
  engineBadge,
  chips,
  dirty,
  saving,
  canSubmit,
  onSubmit,
  onRun,
  onDuplicate,
  onDelete,
  onCancel,
}: AgentHeroProps) {
  const t = useDetailT();
  const tk = useTranslations();
  return (
    <Stack wrap align="start" direction="row" gap="200" justify="between">
      <Stack align="center" direction="row" gap="200">
        <EngineBadge {...engineBadge}>
          <IconTile alt={title} glyph={glyph as IconName} size="lg" src={avatar} />
        </EngineBadge>
        <Stack gap="75">
          <Stack wrap align="baseline" direction="row" gap="150">
            <Typography
              data-testid={TestId.Title}
              type="h1"
              variant={title ? undefined : "tertiary"}
            >
              {title || t("untitled")}
            </Typography>
            <Typography mono size="xs" type="note" variant="tertiary">
              {fileName}
            </Typography>
          </Stack>
          <Typography as="div" size="sm" type="note" variant="secondary">
            {isNew ? (
              t("newSub")
            ) : (
              <Stack wrap align="center" direction="row" gap="100">
                {role && <span>{role}</span>}
                {role && department && <span>·</span>}
                {department && (
                  <TextLink
                    href={`/workforce/departments/${department.id}`}
                    linkComponent={Link as SubNavLinkComponent}
                  >
                    {department.name}
                  </TextLink>
                )}
              </Stack>
            )}
          </Typography>
          <Container padding={["50", "0", "0", "0"]}>
            <Stack wrap direction="row" gap="75">
              <Tag>{chips.model}</Tag>
              <Tag>{chips.thinking}</Tag>
              <Tag>{chips.engine}</Tag>
            </Stack>
          </Container>
        </Stack>
      </Stack>

      <Stack wrap align="center" direction="row" gap="75">
        {isNew ? (
          <>
            <Button data-testid={TestId.Cancel} intent="ghost" onClick={onCancel} size="sm">
              {tk("common.cancel")}
            </Button>
            <Button
              data-testid={TestId.Create}
              disabled={!canSubmit}
              icon="check"
              intent="primary"
              loading={saving}
              onClick={onSubmit}
              size="sm"
            >
              {t("createAgent")}
            </Button>
          </>
        ) : (
          <>
            <Button
              data-testid={TestId.Run}
              icon="play"
              intent="secondary"
              onClick={onRun}
              size="sm"
            >
              {t("run")}
            </Button>
            <Button
              data-testid={TestId.Duplicate}
              icon="copy"
              intent="ghost"
              onClick={onDuplicate}
              size="sm"
            >
              {t("duplicate")}
            </Button>
            <Button
              data-testid={TestId.Delete}
              icon="trash"
              intent="ghost"
              onClick={onDelete}
              size="sm"
            >
              {t("delete")}
            </Button>
            <Button
              data-testid={TestId.Save}
              disabled={!dirty || !canSubmit}
              icon={dirty ? "check" : undefined}
              intent="primary"
              loading={saving}
              onClick={onSubmit}
              size="sm"
              title={dirty ? t("saveHint") : t("allSaved")}
            >
              {dirty ? t("save") : t("saved")}
              {dirty && <Kbd>⌘S</Kbd>}
            </Button>
          </>
        )}
      </Stack>
    </Stack>
  );
}
