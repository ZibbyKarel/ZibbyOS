"use client";

import type { Command, Hook, McpServer, RegistryBindings } from "@zibby/contracts";
import { type DepartmentId } from "@zibby/contracts";
import {
  Button,
  CardSkeleton,
  Container,
  EmptyState,
  Grid,
  Icon,
  IconTile,
  ListHeader,
  ListSection,
  ListToolbar,
  RegistryList,
  RegistryRow,
  SkillTile,
  Stack,
  StatusDot,
  SubNav,
  type SubNavLinkComponent,
  Tag,
  Toggle,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useDepartmentLookup } from "../../departments/useDepartmentLookup";
import { PageContainer } from "../../../components/PageContainer/PageContainer";
import { QueryError } from "../../../components/LoadError/QueryError";
import { slug } from "../../../utils/slug";
import { AgentsByDepartment } from "../../agents/components/AgentsByDepartment";
import { AddCommandModal } from "../../commands/components/AddCommandModal/AddCommandModal";
import { useCreateCommandMutation } from "../../commands/mutations";
import { useCommandsQuery } from "../../commands/queries";
import { HookFormDialog } from "../../hooks/components/HookFormDialog";
import { useCreateHookMutation } from "../../hooks/mutations";
import { useHooksQuery } from "../../hooks/queries";
import {
  type McpServerCreateDraft,
  McpServerFormDialog,
} from "../../mcp/components/McpServerFormDialog";
import {
  useCreateMcpServerMutation,
  useSetMcpCredentialsMutation,
  useUpdateMcpServerMutation,
} from "../../mcp/mutations";
import { useMcpServersQuery } from "../../mcp/queries";
import { toastBus } from "../../../components/Toaster/toastBus";
import { AddSkillModal } from "../../skills/components/AddSkillModal/AddSkillModal";
import { InstallExternalSkillDialog } from "../../skills/components/InstallExternalSkillDialog";
import { useCreateSkillMutation, useSyncAllExternalSkillsMutation } from "../../skills/mutations";
import { useSkillCategoriesQuery, useSkillsQuery } from "../../skills/queries";
import { useUpdateMarketplaceMutation } from "../../marketplaces/mutations";
import { useMarketplaceSkillsQuery, useMarketplacesQuery } from "../../marketplaces/queries";
import { useRegistryBindingsQuery } from "../queries";
import { type RegistryKindParam, registryHref } from "../registryKinds";

export enum RegistriesScreenTestId {
  SyncAllSkills = "registries-sync-all-skills",
  InstallSkills = "registries-install-skills",
  Empty = "registries-empty",
  Add = "registries-add",
  /** Suffixed with the server id. */
  McpToggle = "registries-mcp-toggle",
  BoundIn = "registries-bound-in",
  /** Suffixed with `external`, `marketplaces` or `local`. */
  SkillSection = "registries-skill-section",
}

/** The in-page kind switcher order (the design's), not the route registry's. */
const TAB_ORDER = ["skills", "commands", "hooks", "mcp"] as const;

export interface RegistriesScreenProps {
  kind: RegistryKindParam;
  /** `/system/registries/[kind]/new` — pre-opens the (unchanged) creation dialog;
   *  closing it without creating anything returns to the plain list route. */
  openCreateOnMount?: boolean;
}

/** The department tab a registry kind's "Bound in" tag links to (D-011/O-09) —
 *  `commands` has no dedicated department tab, so its tags render unlinked. */
const DEPARTMENT_TAB: Partial<Record<RegistryKindParam, string>> = {
  agents: "team",
  skills: "skills",
  mcp: "integrations",
  hooks: "hooks",
};

/** The card footer for an item bound in departments, or none — an empty footer would still draw its divider. */
function boundIn(kind: RegistryKindParam, departmentIds?: DepartmentId[]) {
  return departmentIds && departmentIds.length > 0 ? (
    <BoundIn departmentIds={departmentIds} kind={kind} />
  ) : undefined;
}

/**
 * The "Bound in" card footer: department codes linking to the department tab that
 * binds the item. Lives in the card's `actions` slot, outside its open target, so
 * the links never nest inside the card's button.
 */
function BoundIn({
  kind,
  departmentIds: ids,
}: {
  kind: RegistryKindParam;
  departmentIds: DepartmentId[];
}) {
  const t = useTranslations("registries");
  const departments = useDepartmentLookup();
  const tab = DEPARTMENT_TAB[kind];
  return (
    <Stack
      wrap
      align="center"
      data-testid={RegistriesScreenTestId.BoundIn}
      direction="row"
      gap="50"
    >
      <Typography mono size="xs" type="note" variant="tertiary">
        {t("columns.boundIn")}
      </Typography>
      {ids.map((id) => {
        const code = departments.get(id)?.code ?? id;
        const tag = (
          <Tag key={id} size="sm">
            {code}
          </Tag>
        );
        return tab ? (
          <Link href={`/workforce/departments/${id}/${tab}`} key={id}>
            {tag}
          </Link>
        ) : (
          tag
        );
      })}
    </Stack>
  );
}

/**
 * `/system/registries/[kind]` — Seznamy "Registry": one header (breadcrumb, live count line,
 * sync / install / add actions), a search toolbar, an in-page kind switcher with counts and a
 * density list per kind — grouped skill tiles, terminal-style command rows, "event → command"
 * hook rows, MCP status rows with an enabled switch. Kind switching also stays in the shell's
 * sub-nav row (`AppShell`). "Bound in" derives from `GET /api/registries/bindings` (O-09 —
 * read-only). A row/tile click opens the unchanged `/system/registries/<kind>/[id]` detail; creation
 * reuses each domain's existing create-only dialog.
 */
export function RegistriesScreen({ kind, openCreateOnMount }: RegistriesScreenProps) {
  const t = useTranslations("registries");
  const tl = useTranslations("registries.list");
  const router = useRouter();
  const [creating, setCreating] = useState(Boolean(openCreateOnMount));
  const [search, setSearch] = useState("");

  const closeCreate = () => {
    setCreating(false);
    if (openCreateOnMount) router.replace(registryHref(kind) as Route);
  };

  const bindings: RegistryBindings | undefined = useRegistryBindingsQuery().data;
  const skillsQuery = useSkillsQuery();
  const marketplaceSkills = useMarketplaceSkillsQuery().data ?? [];
  const mcpQuery = useMcpServersQuery();
  const hooksQuery = useHooksQuery();
  const commandsQuery = useCommandsQuery();

  const skills = skillsQuery.data ?? [];
  const counts = {
    skills: skills.length + marketplaceSkills.length,
    commands: commandsQuery.data?.length ?? 0,
    hooks: hooksQuery.data?.length ?? 0,
    mcp: mcpQuery.data?.length ?? 0,
  };

  const addButton = (
    <Button
      data-testid={RegistriesScreenTestId.Add}
      icon="plus"
      intent="ink"
      onClick={() =>
        // Agents are created on their own page, not in a dialog.
        kind === "agents" ? router.push("/workforce/agents/new" as Route) : setCreating(true)
      }
    >
      {t(`add.${kind}`)}
    </Button>
  );

  const countFragments = () => {
    const plain = (text: string) => ({ text, tone: "plain" as const });
    if (kind === "skills") {
      const external = skills.filter((s) => s.source).length;
      return [
        plain(tl("count.skills", { count: counts.skills })),
        plain(tl("count.external", { count: external })),
        plain(tl("count.marketplaces", { count: marketplaceSkills.length })),
        plain(tl("count.local", { count: skills.length - external })),
      ];
    }
    if (kind === "mcp") {
      const on = (mcpQuery.data ?? []).filter((s) => s.enabled).length;
      return [
        plain(tl("count.mcp", { count: counts.mcp })),
        plain(tl("count.mcpOn", { count: on })),
      ];
    }
    if (kind === "commands" || kind === "hooks")
      return [plain(tl(`count.${kind}`, { count: counts[kind] }))];
    return [];
  };

  const tabs = TAB_ORDER.map((k) => ({
    href: registryHref(k),
    label: t(`kinds.${k}`),
    count: counts[k],
    active: k === kind,
  }));
  const q = search.trim().toLowerCase();
  const match = (...fields: (string | undefined)[]) =>
    q === "" || fields.some((f) => f?.toLowerCase().includes(q));

  return (
    <Container padding={["300", "350"]}>
      <PageContainer>
        <Stack gap="250">
          <ListHeader
            actions={
              <>
                {kind === "skills" && <ExternalSkillActions />}
                {addButton}
              </>
            }
            count={countFragments()}
            route={registryHref(kind)}
            section={tl("section")}
            title={tl("title")}
          />

          {kind === "agents" ? (
            <AgentsByDepartment />
          ) : (
            <>
              <ListToolbar
                search={{
                  value: search,
                  onChange: setSearch,
                  placeholder: tl("searchPlaceholder"),
                }}
              />
              <SubNav items={tabs} linkComponent={Link as SubNavLinkComponent} />
              {kind === "skills" && (
                <SkillsList
                  add={addButton}
                  bindings={bindings?.skills}
                  marketplaceSkills={marketplaceSkills.filter((s) => match(s.name, s.id, s.desc))}
                  query={skillsQuery}
                  search={q}
                  skills={skills.filter((s) => match(s.name, s.id, s.desc))}
                />
              )}
              {kind === "mcp" && (
                <McpList
                  add={addButton}
                  bindings={bindings?.mcp}
                  query={mcpQuery}
                  rows={(mcpQuery.data ?? []).filter((s) =>
                    match(s.name, s.id, s.desc, s.command, s.url),
                  )}
                  search={q}
                />
              )}
              {kind === "hooks" && (
                <HooksList
                  add={addButton}
                  bindings={bindings?.hooks}
                  query={hooksQuery}
                  rows={(hooksQuery.data ?? []).filter((h) =>
                    match(h.name, h.id, h.desc, h.command, h.event),
                  )}
                  search={q}
                />
              )}
              {kind === "commands" && (
                <CommandsList
                  add={addButton}
                  bindings={bindings?.commands}
                  query={commandsQuery}
                  rows={(commandsQuery.data ?? []).filter((c) => match(c.id, c.description))}
                  search={q}
                />
              )}
            </>
          )}
        </Stack>
      </PageContainer>

      {creating && kind === "skills" && <CreateSkillDialog onClose={closeCreate} />}
      {creating && kind === "mcp" && <CreateMcpDialog onClose={closeCreate} />}
      {creating && kind === "hooks" && <CreateHookDialog onClose={closeCreate} />}
      {creating && kind === "commands" && <CreateCommandDialog onClose={closeCreate} />}
    </Container>
  );
}

/**
 * Skills-only header actions: install from a GitHub repo, and sync every external skill
 * plus every connected marketplace (their skills are listed on this page too).
 */
function ExternalSkillActions() {
  const t = useTranslations("skills.external");
  const syncAll = useSyncAllExternalSkillsMutation();
  const { data: marketplaces } = useMarketplacesQuery();
  const updateMarketplace = useUpdateMarketplaceMutation();
  const [syncing, setSyncing] = useState(false);
  const [installing, setInstalling] = useState(false);

  const sync = () => {
    setSyncing(true);
    syncAll.mutate(
      { body: {} },
      {
        onSuccess: async ({ body }) => {
          const results = await Promise.allSettled(
            (marketplaces ?? []).map((m) =>
              updateMarketplace.mutateAsync({ params: { id: m.id } }),
            ),
          );
          const marketplaceFailed = results.filter((r) => r.status === "rejected").length;
          const failed = body.failed.length + marketplaceFailed;
          setSyncing(false);
          toastBus.emit({
            severity: failed > 0 ? "error" : "ok",
            message: t("syncAllDone", {
              checked: body.checked + results.length,
              updated: body.updated.length,
              failed,
            }),
          });
        },
        onError: () => setSyncing(false),
      },
    );
  };

  return (
    <>
      <Button
        data-testid={RegistriesScreenTestId.SyncAllSkills}
        icon="retry"
        intent="ghost"
        loading={syncing}
        onClick={sync}
      >
        {t("syncAllAction")}
      </Button>
      <Button
        data-testid={RegistriesScreenTestId.InstallSkills}
        icon="branch"
        intent="secondary"
        onClick={() => setInstalling(true)}
      >
        {t("installAction")}
      </Button>
      {installing && <InstallExternalSkillDialog onClose={() => setInstalling(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Per-kind lists
// ---------------------------------------------------------------------------

type Bindings = Record<string, DepartmentId[]>;

interface ListQuery {
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

interface KindListProps<T> {
  query: ListQuery;
  rows: T[];
  bindings?: Bindings;
  /** The normalised search text — non-empty turns the empty state into "nothing found". */
  search: string;
  add: ReactNode;
}

/** Loading / error / empty / nothing-found around one kind's list; renders `children` when rows exist. */
function KindState({
  query,
  total,
  shown,
  search,
  add,
  empty,
  skeleton,
  children,
}: {
  query: ListQuery;
  total: number;
  shown: number;
  search: string;
  add: ReactNode;
  empty: string;
  skeleton: "tile" | "row";
  children: ReactNode;
}) {
  const t = useTranslations("registries.list");
  if (query.isPending)
    return skeleton === "tile" ? (
      <Grid cols={2} gap="100" lg={5} md={3}>
        {Array.from({ length: 10 }).map((_, i) => (
          <CardSkeleton key={i} shape="card" />
        ))}
      </Grid>
    ) : (
      <Stack gap="0">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} shape="row" />
        ))}
      </Stack>
    );
  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;
  if (total === 0)
    return (
      <EmptyState
        action={add}
        data-testid={RegistriesScreenTestId.Empty}
        icon="stack"
        title={empty}
      />
    );
  if (shown === 0 && search)
    return <EmptyState body={t("noMatchBody")} icon="search" title={t("noMatch", { q: search })} />;
  return <>{children}</>;
}

type SkillRow = NonNullable<ReturnType<typeof useSkillsQuery>["data"]>[number];

function SkillsList({
  query,
  skills,
  marketplaceSkills,
  bindings,
  search,
  add,
}: {
  query: ListQuery;
  skills: SkillRow[];
  marketplaceSkills: ReturnType<typeof useMarketplaceSkillsQuery>["data"] & object;
  bindings?: Bindings;
  search: string;
  add: ReactNode;
}) {
  const t = useTranslations("registries");
  const router = useRouter();
  const allSkills = useSkillsQuery().data ?? [];
  const allMarketplace = useMarketplaceSkillsQuery().data ?? [];

  const renderSkill = (s: SkillRow) => {
    const hasUpdate = Boolean(s.source?.latestSha && s.source.latestSha !== s.source.sha);
    return (
      <SkillTile
        description={s.desc}
        footer={
          <>
            {boundIn("skills", bindings?.[s.id]) ?? (
              <Typography mono size="xs" type="note" variant="tertiary">
                {`${t("columns.boundIn")} ${t("list.nowhere")}`}
              </Typography>
            )}
            {hasUpdate && (
              <Tag size="sm" tone="accent">
                {t("list.updateAvailable")}
              </Tag>
            )}
          </>
        }
        key={s.id}
        name={s.id}
        onOpen={() => router.push(registryHref("skills", s.id) as Route)}
        openLabel={t("openAria", { name: s.name ?? s.id })}
        source={s.source ? s.source.owner : (s.category ?? t("skillTypeFallback"))}
      />
    );
  };

  const sections = [
    {
      key: "external",
      icon: "globe" as const,
      label: t("skillSections.external"),
      tiles: skills.filter((s) => s.source).map(renderSkill),
    },
    {
      key: "marketplaces",
      icon: "stack" as const,
      label: t("skillSections.marketplaces"),
      // Read-only: the plugin owns the skill, so there is no detail page to open.
      tiles: marketplaceSkills.map((s) => (
        <SkillTile
          description={s.desc}
          key={s.id}
          name={s.name}
          source={`${s.marketplace} · ${s.plugin}`}
        />
      )),
    },
    {
      key: "local",
      icon: "file" as const,
      label: t("skillSections.local"),
      tiles: skills.filter((s) => !s.source).map(renderSkill),
    },
  ].filter((section) => section.tiles.length > 0);

  return (
    <KindState
      add={add}
      empty={t("emptySkills")}
      query={query}
      search={search}
      shown={sections.length}
      skeleton="tile"
      total={allSkills.length + allMarketplace.length}
    >
      <Stack gap="300">
        {sections.map(({ key, icon, label, tiles }) => (
          <span data-testid={`${RegistriesScreenTestId.SkillSection}-${key}`} key={key}>
            <ListSection count={tiles.length} icon={icon} title={label}>
              <Grid cols={2} gap="100" lg={5} md={3}>
                {tiles}
              </Grid>
            </ListSection>
          </span>
        ))}
      </Stack>
    </KindState>
  );
}

function McpList({ query, rows, bindings, search, add }: KindListProps<McpServer>) {
  const t = useTranslations("registries");
  const router = useRouter();
  const update = useUpdateMcpServerMutation();
  const total = useMcpServersQuery().data?.length ?? 0;
  return (
    <KindState
      add={add}
      empty={t("emptyMcp")}
      query={query}
      search={search}
      shown={rows.length}
      skeleton="row"
      total={total}
    >
      <RegistryList>
        {rows.map((s) => {
          const name = s.name ?? s.id;
          return (
            <RegistryRow
              aside={
                <>
                  <Tag>{s.type}</Tag>
                  <Typography mono truncate size="xs" type="note" variant="tertiary">
                    {(s.type === "stdio" ? s.command : s.url) ?? s.id}
                  </Typography>
                </>
              }
              key={s.id}
              lead={<IconTile glyph="server" size="md" tone="neutral" />}
              onOpen={() => router.push(registryHref("mcp", s.id) as Route)}
              openLabel={t("openAria", { name })}
              trailing={
                <Stack align="center" direction="row" gap="150">
                  {boundIn("mcp", bindings?.[s.id])}
                  <Toggle
                    checked={s.enabled}
                    data-testid={`${RegistriesScreenTestId.McpToggle}-${s.id}`}
                    label={t("list.toggleMcp", { name })}
                    onChange={(enabled) =>
                      update.mutate({ params: { id: s.id }, body: { enabled } })
                    }
                  />
                </Stack>
              }
            >
              <Typography size="md" type="note" weight="medium">
                {name}
              </Typography>
              <Stack align="center" direction="row" gap="75">
                <StatusDot size="75" tone={s.enabled ? "ok" : "idle"} />
                <Typography size="xs" type="note" variant="tertiary">
                  {s.enabled ? t("status.enabled") : t("status.disabled")}
                </Typography>
              </Stack>
            </RegistryRow>
          );
        })}
      </RegistryList>
    </KindState>
  );
}

function HooksList({ query, rows, bindings, search, add }: KindListProps<Hook>) {
  const t = useTranslations("registries");
  const router = useRouter();
  const total = useHooksQuery().data?.length ?? 0;
  return (
    <KindState
      add={add}
      empty={t("emptyHooks")}
      query={query}
      search={search}
      shown={rows.length}
      skeleton="row"
      total={total}
    >
      <RegistryList>
        {rows.map((h) => (
          <RegistryRow
            key={h.id}
            lead={
              <Stack align="center" direction="row" gap="100">
                <Tag icon="bolt">{h.event}</Tag>
                <Icon name="arrow" size="sm" />
              </Stack>
            }
            leadWidth="wide"
            onOpen={() => router.push(registryHref("hooks", h.id) as Route)}
            openLabel={t("openAria", { name: h.name ?? h.id })}
            trailing={boundIn("hooks", bindings?.[h.id])}
          >
            <Typography mono truncate size="xs" type="note">
              {h.command}
            </Typography>
          </RegistryRow>
        ))}
      </RegistryList>
    </KindState>
  );
}

function CommandsList({ query, rows, bindings, search, add }: KindListProps<Command>) {
  const t = useTranslations("registries");
  const router = useRouter();
  const total = useCommandsQuery().data?.length ?? 0;
  return (
    <KindState
      add={add}
      empty={t("emptyCommands")}
      query={query}
      search={search}
      shown={rows.length}
      skeleton="row"
      total={total}
    >
      <RegistryList dashed terminalTitle={t("list.terminalTitle")}>
        {rows.map((c) => (
          <RegistryRow
            key={c.id}
            lead={
              <Typography mono type="note" variant="tertiary">
                ›
              </Typography>
            }
            onOpen={() => router.push(registryHref("commands", c.id) as Route)}
            openLabel={t("openAria", { name: `/${c.id}` })}
            trailing={
              <Stack align="center" direction="row" gap="150">
                {boundIn("commands", bindings?.[c.id])}
                <Tag tone={c["disable-model-invocation"] ? "neutral" : "accent"}>
                  {c["disable-model-invocation"]
                    ? t("commandScope.manual")
                    : t("commandScope.auto")}
                </Tag>
              </Stack>
            }
          >
            <Stack wrap align="baseline" direction="row" gap="100">
              <Typography mono size="md" type="note" weight="medium">
                {`/${c.id}`}
              </Typography>
              {c["argument-hint"] && (
                <Typography mono size="xs" type="note" variant="tertiary">
                  {c["argument-hint"]}
                </Typography>
              )}
            </Stack>
            <Typography truncate size="xs" type="note" variant="tertiary">
              {c.description}
            </Typography>
          </RegistryRow>
        ))}
      </RegistryList>
    </KindState>
  );
}

// ---------------------------------------------------------------------------
// Creation dialogs — unchanged forms, reused verbatim from each domain
// ---------------------------------------------------------------------------

function CreateSkillDialog({ onClose }: { onClose: () => void }) {
  const tk = useTranslations();
  const router = useRouter();
  const { data: categories = [] } = useSkillCategoriesQuery();
  const createSkill = useCreateSkillMutation();

  return (
    <AddSkillModal
      categories={categories.map((c) => c.name)}
      onClose={onClose}
      onSubmit={({ name, desc, category, glyph, instructions }) => {
        const id = slug(name, "novy");
        const safeDesc = desc || tk("defaults.skill");
        createSkill.mutate(
          {
            body: {
              id,
              name: name || id,
              glyph,
              desc: safeDesc,
              category,
              instructions: instructions || safeDesc,
            },
          },
          {
            onSuccess: () => {
              onClose();
              router.push(`/system/registries/skills/${id}`);
            },
          },
        );
      }}
      pending={createSkill.isPending}
    />
  );
}

function CreateMcpDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const create = useCreateMcpServerMutation();
  const setCredentials = useSetMcpCredentialsMutation();

  const onCreate = ({ create: body, authToken }: McpServerCreateDraft) => {
    create.mutate(
      { body },
      {
        onSuccess: () => {
          if (authToken) {
            setCredentials.mutate({ params: { id: body.id }, body: { authToken } });
          }
          onClose();
          router.push(`/system/registries/mcp/${body.id}`);
        },
      },
    );
  };

  return <McpServerFormDialog onClose={onClose} onCreate={onCreate} />;
}

function CreateHookDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const create = useCreateHookMutation();

  return (
    <HookFormDialog
      onClose={onClose}
      onCreate={(body) =>
        create.mutate(
          { body },
          {
            onSuccess: () => {
              onClose();
              router.push(`/system/registries/hooks/${body.id}`);
            },
          },
        )
      }
    />
  );
}

function CreateCommandDialog({ onClose }: { onClose: () => void }) {
  const tk = useTranslations();
  const router = useRouter();
  const createCommand = useCreateCommandMutation();

  return (
    <AddCommandModal
      onClose={onClose}
      onSubmit={({
        id,
        description,
        argumentHint,
        allowedTools,
        model,
        disableModelInvocation,
        enabled,
        instructions,
      }) =>
        createCommand.mutate(
          {
            body: {
              id,
              description,
              "argument-hint": argumentHint,
              "allowed-tools": allowedTools,
              model,
              "disable-model-invocation": disableModelInvocation,
              enabled,
              instructions: instructions || tk("defaults.command"),
            },
          },
          {
            onSuccess: () => {
              onClose();
              router.push(`/system/registries/commands/${id}`);
            },
          },
        )
      }
      pending={createCommand.isPending}
    />
  );
}
