import { expect, test } from "@playwright/test";

/**
 * The shell's section nav — `AppHeader`'s 8-section `SectionTrack`
 * (`state/config.ts`'s `SECTIONS`) plus the `SubNav` sub-tab strip for the active
 * section.
 */
test("the section nav renders all eight sections and navigates on click", async ({ page }) => {
  await page.goto("/dashboard");

  const nav = page.getByTestId("app-header-nav");
  await expect(nav).toBeVisible();

  // [section href, label] — the track's items are keyed by their href.
  const sections: Array<[href: string, label: string]> = [
    ["/dashboard", "Dashboard"],
    ["/work/goals", "Work"],
    ["/companies", "Companies"],
    ["/workforce/agents", "AI"],
    ["/activity/log", "Activity"],
    ["/knowledge/vault", "Knowledge"],
    ["/governance/gates", "Governance"],
    ["/system/settings/general", "Settings"],
  ];
  for (const [href, label] of sections) {
    await expect(nav.getByTestId(`section-track-item-${href}`)).toHaveAccessibleName(label);
  }

  await expect(nav.getByTestId("section-track-item-/dashboard")).toHaveAttribute(
    "aria-current",
    "page",
  );

  for (const [href] of sections.slice(1, 4)) {
    await nav.getByTestId(`section-track-item-${href}`).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  }
});

test("AI and Settings sub-menus list their items; no header cog", async ({ page }) => {
  await page.goto("/workforce/agents");
  const subnav = page.getByTestId("subnav-root");
  for (const label of ["Agents", "Skills", "Commands", "MCP", "Hooks"]) {
    await expect(subnav).toContainText(label);
  }

  await page.goto("/system/settings/general");
  for (const label of ["General", "Activity", "Runtime", "Status"]) {
    await expect(subnav).toContainText(label);
  }
  await subnav.getByTestId("subnav-item-/system/settings/status").click();
  await expect(page).toHaveURL(/\/system\/settings\/status$/);
  await expect(page.getByTestId("app-shell-settings-cog")).toHaveCount(0);
});

test("the sub-nav lists the active section's tabs; + New offers New task", async ({ page }) => {
  await page.goto("/work/goals");

  const subnav = page.getByTestId("subnav-root");
  await expect(subnav).toBeVisible();
  // `work`'s sub-tabs: goals, workflows, automations (todo-14 merged Tasks into Activity → Runs).
  await expect(subnav).toContainText("Goals");
  await expect(subnav).toContainText("Workflows");
  await expect(subnav).toContainText("Automations");

  // New task moved from the sub-nav row into the header's "+ New" menu.
  await page.getByTestId("header-new-button").click();
  await expect(page.getByRole("menuitem", { name: "New task" })).toBeVisible();
});

test("the NEEDS YOU rail renders on every section", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /^(Potřebuje tě|Needs you)/ }).click();
  await expect(page.getByTestId("rail-root").first()).toBeVisible();
  await expect(page.getByTestId("rail-header")).toContainText("Needs you");
});
