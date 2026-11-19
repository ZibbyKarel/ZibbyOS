"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Button,
  CardSkeleton,
  Container,
  EmptyState,
  Grid,
  type IconName,
  ListEmptyRow,
  ListHeader,
  ListSection,
  ListToolbar,
  Stack,
  Typography,
} from "@zibby/design-system";
import type { Project } from "@zibby/contracts";
import { QueryError } from "../../../components/LoadError/QueryError";
import { CategoryDialog } from "../../../components/CategoryDialog/CategoryDialog";
import { useRunsQuery } from "../../runs";
import { ProjectCard } from "../components/ProjectCard";
import { type ProjectChip, matchesChip, matchesSearch } from "../projectFilter";
import { countLiveByProject } from "../projectListStats";
import { useBudgetQuery, useProjectCategoriesQuery, useProjectsQuery } from "../queries";
import { useCreateProjectCategoryMutation, useDeleteProjectCategoryMutation } from "../mutations";

/**
 * `/projects` — the project catalog (design Seznamy "Projekty"): shared list header with a
 * live count line, search + status chips (all / running / waiting on you / over budget, all
 * derived from the runs feed and budget readout), category sections with their management
 * (add, delete when empty) and one card per project.
 */
export function ProjectsListScreen() {
  const t = useTranslations("projects");
  const router = useRouter();
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];
  const { data: categories = [] } = useProjectCategoriesQuery();
  const { data: budget } = useBudgetQuery();
  const { runs } = useRunsQuery();
  const budgetByProject = new Map((budget?.projects ?? []).map((p) => [p.projectId, p]));
  const live = countLiveByProject(runs);
  const createCategory = useCreateProjectCategoryMutation();
  const deleteCategory = useDeleteProjectCategoryMutation();

  const [addingCategory, setAddingCategory] = useState(false);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ProjectChip>("all");

  const ctx = { live, budget: budgetByProject };
  const chipCount = (c: ProjectChip) => projects.filter((p) => matchesChip(p, c, ctx)).length;
  const visible = projects.filter((p) => matchesChip(p, chip, ctx) && matchesSearch(p, search));
  const filtered = chip !== "all" || search.trim() !== "";

  const runningTotal = [...live.values()].reduce((n, c) => n + c.running, 0);
  const needsYouTotal = [...live.values()].reduce((n, c) => n + c.needsYou, 0);

  // Projects whose category was deleted (or never set) surface in a trailing
  // fallback section instead of vanishing from the catalog.
  const knownNames = new Set(categories.map((c) => c.name));
  const uncategorized = visible.filter((p) => !p.category || !knownNames.has(p.category));

  const openProject = (p: Project) => router.push(`/projects/${p.id}` as Route);
  const addProject = () => router.push("/projects/new" as Route);

  const renderCards = (items: Project[]) => (
    <Grid cols={1} gap="200" lg={3} sm={2}>
      {items.map((p) => (
        <ProjectCard
          budget={budgetByProject.get(p.id)}
          key={p.id}
          needsYou={live.get(p.id)?.needsYou}
          onOpen={openProject}
          project={p}
        />
      ))}
    </Grid>
  );

  const renderSection = (key: string, label: string, glyph: IconName, items: Project[]) => {
    const empty = items.length === 0;
    // While filtering, hide groups the filter emptied; a truly empty category stays (with delete).
    if (empty && filtered) return null;
    return (
      <ListSection
        count={items.length}
        icon={glyph}
        key={key}
        title={label}
        trailing={
          empty && key !== "__uncategorized" ? (
            <Button
              aria-label={t("deleteEmptyCategoryAria", { name: label })}
              icon="trash"
              intent="danger"
              onClick={() => deleteCategory.mutate({ params: { name: label } })}
              size="sm"
            >
              {t("deleteEmptyCategory")}
            </Button>
          ) : undefined
        }
      >
        {empty ? <ListEmptyRow text={t("emptyCategory")} /> : renderCards(items)}
      </ListSection>
    );
  };

  return (
    <Container padding={["300", "350"]}>
      <Stack gap="250">
        <ListHeader
          actions={
            <>
              <Button icon="plus" intent="ghost" onClick={() => setAddingCategory(true)}>
                {t("categoryAction")}
              </Button>
              <Button icon="plus" intent="ink" onClick={addProject}>
                {t("newProject")}
              </Button>
            </>
          }
          count={[
            {
              text: t("countLine", { count: projects.length, categories: categories.length }),
              tone: "plain",
            },
            ...(runningTotal > 0
              ? [{ text: t("runsRunningTotal", { count: runningTotal }), tone: "run" as const }]
              : []),
            ...(needsYouTotal > 0
              ? [{ text: t("needsYouTotal", { count: needsYouTotal }), tone: "warn" as const }]
              : []),
          ]}
          route="/projects"
          section={t("section")}
          title={t("title")}
        />

        {projects.length > 0 && (
          <ListToolbar
            activeChip={chip}
            chips={[
              { id: "all", label: t("filterAll"), count: projects.length },
              { id: "running", label: t("filterRunning"), count: chipCount("running") },
              { id: "needsYou", label: t("filterNeedsYou"), count: chipCount("needsYou") },
              { id: "overBudget", label: t("filterOverBudget"), count: chipCount("overBudget") },
            ]}
            onChipChange={(id) => setChip(id as ProjectChip)}
            search={{ value: search, onChange: setSearch, placeholder: t("searchPlaceholder") }}
          />
        )}

        {projectsQuery.isPending ? (
          <Grid cols={1} gap="200" lg={3} sm={2}>
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} shape="card" />
            ))}
          </Grid>
        ) : projectsQuery.isError ? (
          <QueryError onRetry={() => void projectsQuery.refetch()} />
        ) : categories.length === 0 && projects.length === 0 ? (
          <EmptyState
            action={
              <Button icon="plus" intent="ink" onClick={addProject}>
                {t("addProject")}
              </Button>
            }
            body={t("emptyDescription")}
            icon="code"
            title={t("emptyTitle")}
          />
        ) : filtered && visible.length === 0 ? (
          <Typography size="sm" type="note" variant="tertiary">
            {t("noMatch")}
          </Typography>
        ) : (
          <Stack gap="300">
            {categories.map((cat) =>
              renderSection(
                cat.name,
                cat.name,
                (cat.glyph as IconName) ?? "code",
                visible.filter((p) => p.category === cat.name),
              ),
            )}
            {uncategorized.length > 0 &&
              renderSection("__uncategorized", t("uncategorized"), "code", uncategorized)}
          </Stack>
        )}
      </Stack>

      {addingCategory && (
        <CategoryDialog
          existing={categories.map((c) => c.name)}
          labels={{
            title: t("categoryDialog.title"),
            subtitle: t("categoryDialog.subtitle"),
            nameLabel: t("categoryDialog.nameLabel"),
            namePlaceholder: t("categoryDialog.namePlaceholder"),
            glyphLabel: t("categoryDialog.glyphLabel"),
            submit: t("addCategory"),
            duplicate: (name) => t("categoryDialog.duplicate", { name }),
          }}
          onClose={() => setAddingCategory(false)}
          onSubmit={(category) =>
            createCategory.mutate({ body: category }, { onSuccess: () => setAddingCategory(false) })
          }
          pending={createCategory.isPending}
        />
      )}
    </Container>
  );
}
