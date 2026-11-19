"use client";

import { useTranslations } from "next-intl";
import { useDetailT } from "../useDetailT";
import Link from "next/link";
import {
  Button,
  Container,
  Divider,
  EngineBadge,
  type EngineBadgeProps,
  Icon,
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
    <>
      <Container padding={["250", "0"]}>
        <Stack wrap align="start" direction="row" gap="200" justify="between">
          <Stack align="start" direction="row" gap="200">
            <EngineBadge {...engineBadge}>
              <IconTile alt={title} glyph={isNew ? "user" : undefined} size="xl" src={avatar}>
                {!isNew && !avatar ? initials(title) : undefined}
              </IconTile>
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
                        <Stack inline align="center" as="span" direction="row" gap="50">
                          <Icon name="users" size="xs" />
                          {department.name}
                        </Stack>
                      </TextLink>
                    )}
                  </Stack>
                )}
              </Typography>
              <Stack wrap direction="row" gap="75">
                <Tag>{chips.model}</Tag>
                <Tag>{chips.thinking}</Tag>
                <Tag>{chips.engine}</Tag>
              </Stack>
            </Stack>
          </Stack>

          <Stack wrap align="center" direction="row" gap="75">
            {isNew ? (
              <>
                <Button data-testid={TestId.Cancel} intent="ghost" onClick={onCancel} size="md">
                  {tk("common.cancel")}
                </Button>
                <Button
                  data-testid={TestId.Create}
                  disabled={!canSubmit}
                  icon="check"
                  intent="ink"
                  loading={saving}
                  onClick={onSubmit}
                  size="md"
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
                  size="md"
                >
                  {t("run")}
                </Button>
                <Button
                  data-testid={TestId.Duplicate}
                  icon="copy"
                  intent="ghost"
                  onClick={onDuplicate}
                  size="md"
                >
                  {t("duplicate")}
                </Button>
                <Button
                  data-testid={TestId.Delete}
                  icon="trash"
                  intent="danger"
                  onClick={onDelete}
                  size="md"
                >
                  {t("delete")}
                </Button>
                <Button
                  data-testid={TestId.Save}
                  disabled={!dirty || !canSubmit}
                  icon={dirty ? "check" : undefined}
                  intent="ink"
                  loading={saving}
                  onClick={onSubmit}
                  size="md"
                  title={dirty ? t("saveHint") : t("allSaved")}
                >
                  {dirty ? t("save") : t("saved")}
                  {dirty && <Kbd>⌘S</Kbd>}
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Container>
      <Divider />
    </>
  );
}

/** Two-letter tile text from the display name ("Code reviewer" → "CR", "Reviewer" → "Re"). */
function initials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const [first = "", second = ""] = words;
  return (words.length > 1 ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).replace(
    /^./,
    (c) => c.toUpperCase(),
  );
}
