import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type AutopilotStatus, NO_AUTOMATION } from "@zibby/contracts";
import { LaneMatrixTestId } from "@zibby/design-system";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_TOKEN_STORAGE_KEY } from "../../../state/operatorToken";
import { AlwaysAskListTestId } from "../components/AlwaysAskList";
import { AutonomyMatrixTestId } from "../components/AutonomyMatrix";
import { renderAutonomy } from "../test/renderAutonomy";
import { AutonomyScreen, AutonomyScreenTestId } from "./AutonomyScreen";

let status: AutopilotStatus = { paused: false, pendingApprovals: 2 };
const save = vi.fn();
const mutate = vi.fn();

vi.mock("../../companies", () => ({
  useCompaniesQuery: () => ({ data: [{ id: "acme", name: "Acme" }] }),
}));
vi.mock("../../teams", () => ({
  useTeamsQuery: () => ({ data: [{ id: "web", name: "Web", companyId: "acme" }] }),
}));
vi.mock("../../projects", () => ({
  useProjectsQuery: () => ({ data: [{ id: "shop", name: "Shop", companyId: "acme" }] }),
}));
vi.mock("../../gates", () => ({
  useGateRulesQuery: () => ({
    data: [
      { id: "floor-pr.merge", name: "Merge PR", system: true, decision: "deny", match: [] },
      { id: "floor-deploy", name: "Deploy", system: true, decision: "ask", match: [] },
      { id: "floor-pr.open", name: "Otevření PR", system: true, decision: "notify", match: [] },
      { id: "gr-push-main", name: "Push do main", decision: "ask", match: [] },
    ],
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../queries", () => ({ useAutopilotQuery: () => ({ data: status }) }));
vi.mock("../mutations", () => ({
  useSetAutopilotMutation: () => ({ mutate, isPending: false }),
}));
vi.mock("../hooks/useSaveAutomation", () => ({ useSaveAutomation: () => save }));

beforeEach(() => {
  save.mockReset().mockResolvedValue("ok");
  mutate.mockReset();
  localStorage.setItem(OPERATOR_TOKEN_STORAGE_KEY, "zby_op_x");
  status = {
    paused: false,
    pendingApprovals: 2,
    automation: {
      global: { ...NO_AUTOMATION, autoReview: "semi" },
      companies: { acme: { autoReview: "auto" } },
      teams: {},
      projects: {},
    },
  };
});

const chip = (node: string, key: string, column: "semi" | "auto") =>
  screen.getByTestId(`${AutonomyMatrixTestId.Chip}-${node}-${key}-${column}`);

describe("AutonomyScreen", () => {
  it("shows two additive columns with the effective levels, exceptions and manual lists", () => {
    renderAutonomy(<AutonomyScreen />);
    expect(screen.getByTestId(`${LaneMatrixTestId.Head}-semi`)).toHaveTextContent("Poloautomat");
    expect(screen.getByTestId(`${LaneMatrixTestId.Head}-auto`)).toHaveTextContent("Automat");
    // global: review semi -> only Poloautomat; acme overrides to auto -> both, with a dot
    expect(chip("global", "autoReview", "semi")).toHaveAttribute("aria-pressed", "true");
    expect(chip("global", "autoReview", "auto")).toHaveAttribute("aria-pressed", "false");
    expect(chip("company:acme", "autoReview", "semi")).toHaveAttribute("aria-pressed", "true");
    expect(chip("company:acme", "autoReview", "auto")).toHaveAttribute("aria-pressed", "true");
    expect(chip("company:acme", "autoReview", "auto")).toHaveAccessibleName(
      "Code review, výjimka proti Výchozí",
    );
    // the sixth capability renders its chip
    expect(chip("global", "autoDecideGoals", "semi")).toHaveAttribute("aria-pressed", "false");
    // the team inherits the company
    expect(chip("team:web", "autoReview", "auto")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(`${AutonomyMatrixTestId.Manual}-team:web`)).toHaveTextContent(
      "Ručně: Připomínky z review, Implementace, Komunikace, Oprava CI, Rozhodování cílů",
    );
    expect(screen.getByTestId(`${AutonomyMatrixTestId.InheritAll}-company:acme`)).toBeVisible();
    expect(screen.queryByTestId(`${AutonomyMatrixTestId.InheritAll}-team:web`)).toBeNull();
    expect(screen.queryByTestId(AutonomyScreenTestId.Unlock)).toBeNull();
  });

  it("builds the always-ask list from the locked system ask/deny gate rules", () => {
    renderAutonomy(<AutonomyScreen />);
    const chips = screen.getAllByTestId(AlwaysAskListTestId.Chip).map((c) => c.textContent);
    expect(chips).toEqual(["Merge PR", "Deploy"]);
    expect(screen.getByTestId(AutonomyScreenTestId.GatesLink)).toHaveTextContent(
      "Pravidla v Gates",
    );
  });

  it("toggling a Global chip saves it as the base level, with toast and undo", async () => {
    renderAutonomy(<AutonomyScreen />);
    await userEvent.click(chip("global", "autoFixCi", "semi"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].global).toEqual({
      ...NO_AUTOMATION,
      autoReview: "semi",
      autoFixCi: "semi",
    });
    const toast = await screen.findByTestId(AutonomyScreenTestId.Toast);
    expect(toast).toHaveTextContent("Oprava CI · Výchozí → jen Poloautomat");
    await userEvent.click(within(toast).getByRole("button"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]?.[0].global.autoFixCi).toBe("manual");
  });

  it("Automat on from manual turns Poloautomat on too; Poloautomat off turns Automat off", async () => {
    renderAutonomy(<AutonomyScreen />);
    await userEvent.click(chip("company:acme", "autoFixCi", "auto"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].companies.acme).toEqual({
      autoReview: "auto",
      autoFixCi: "auto",
    });
    expect(await screen.findByTestId(AutonomyScreenTestId.Toast)).toHaveTextContent(
      "zapnut i Poloautomat",
    );
    save.mockClear();
    await userEvent.click(chip("company:acme", "autoReview", "semi"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    // manual differs from the parent (semi), so it stays an exception
    expect(save.mock.calls[0]?.[0].companies.acme).toEqual({ autoReview: "manual" });
  });

  it("setting a team back to its parent's level removes the exception", async () => {
    status = {
      ...status,
      automation: {
        global: { ...NO_AUTOMATION },
        companies: { acme: { autoReview: "semi" } },
        teams: { web: { autoReview: "auto" } },
        projects: {},
      },
    };
    renderAutonomy(<AutonomyScreen />);
    await userEvent.click(chip("team:web", "autoReview", "auto")); // auto -> semi = company's level
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].teams).toEqual({});
    expect(await screen.findByTestId(AutonomyScreenTestId.Toast)).toHaveTextContent("zase dědí");
  });

  it("toggling a project chip saves projects.<id>, inheriting from its company", async () => {
    renderAutonomy(<AutonomyScreen />);
    // acme sets review to auto, the project inherits it (not from the team)
    expect(chip("project:shop", "autoReview", "auto")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(chip("project:shop", "autoFixCi", "semi"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].projects).toEqual({ shop: { autoFixCi: "semi" } });
    expect(save.mock.calls[0]?.[0].teams).toEqual({});
  });

  it("'Dědit vše' removes every override of the row", async () => {
    renderAutonomy(<AutonomyScreen />);
    await userEvent.click(screen.getByTestId(`${AutonomyMatrixTestId.InheritAll}-company:acme`));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].companies).toEqual({});
  });

  it("collapses a company's teams", async () => {
    renderAutonomy(<AutonomyScreen />);
    expect(screen.getByTestId(`${LaneMatrixTestId.Row}-team:web`)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(`${AutonomyMatrixTestId.Expand}-company:acme`));
    expect(screen.queryByTestId(`${LaneMatrixTestId.Row}-team:web`)).toBeNull();
  });

  it("shows a failure toast when the save is locked (raising needs the token)", async () => {
    save.mockResolvedValue("locked");
    renderAutonomy(<AutonomyScreen />);
    await userEvent.click(chip("company:acme", "autoFixCi", "semi"));
    expect(await screen.findByTestId(AutonomyScreenTestId.Toast)).toHaveTextContent("token");
  });

  it("without a stored token the table stays editable and the unlock field saves one", async () => {
    localStorage.removeItem(OPERATOR_TOKEN_STORAGE_KEY);
    renderAutonomy(<AutonomyScreen />);
    expect(screen.getByTestId(AutonomyScreenTestId.Unlock)).toBeInTheDocument();
    await userEvent.type(screen.getByTestId(AutonomyScreenTestId.UnlockInput), "zby_op_new");
    await userEvent.click(screen.getByTestId(AutonomyScreenTestId.UnlockSave));
    expect(localStorage.getItem(OPERATOR_TOKEN_STORAGE_KEY)).toBe("zby_op_new");
    await waitFor(() => expect(screen.queryByTestId(AutonomyScreenTestId.Unlock)).toBeNull());
  });

  it("when paused it has no pause/resume controls; the matrix is still there", () => {
    status = { ...status, paused: true };
    renderAutonomy(<AutonomyScreen />);
    expect(screen.getByTestId(`${LaneMatrixTestId.Head}-semi`)).toBeInTheDocument();
    for (const id of [
      "autonomy-run-status",
      "autonomy-pause-toggle",
      "autonomy-paused-banner",
      "autonomy-paused-resume",
    ]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(screen.queryByRole("button", { name: /Pustit|Pozastavit|Obnovit/ })).toBeNull();
  });
});
