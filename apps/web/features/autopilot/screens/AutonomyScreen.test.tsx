import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type AutopilotStatus, NO_AUTOMATION } from "@zibby/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_TOKEN_STORAGE_KEY } from "../../../state/operatorToken";
import { AutonomyMatrixTestId } from "../components/AutonomyMatrix";
import { renderAutonomy } from "../test/renderAutonomy";
import { AutonomyScreen, AutonomyScreenTestId } from "./AutonomyScreen";

let status: AutopilotStatus = { level: "off", pendingApprovals: 2 };
const save = vi.fn();
const mutate = vi.fn();

vi.mock("../../companies", () => ({
  useCompaniesQuery: () => ({ data: [{ id: "acme", name: "Acme" }] }),
}));
vi.mock("../../teams", () => ({
  useTeamsQuery: () => ({ data: [{ id: "web", name: "Web", companyId: "acme" }] }),
}));
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
    level: "off",
    pendingApprovals: 2,
    automation: {
      global: { ...NO_AUTOMATION },
      companies: { acme: { autoReview: true } },
      teams: {},
    },
  };
});

const chip = (id: string) =>
  screen
    .getAllByTestId(AutonomyMatrixTestId.Chip)
    .find((el) => el.getAttribute("data-chip") === id) as HTMLElement;

describe("AutonomyScreen", () => {
  it("shows the matrix with inherited chips, a locked Výchozí row and a capped Automat lane", () => {
    renderAutonomy(<AutonomyScreen />);
    // acme overrides review -> auto lane, dotted; web inherits it -> dashed in the same lane
    expect(chip("company:acme:autoReview")).toHaveAttribute("data-lane", "auto");
    expect(chip("team:web:autoReview")).toHaveAttribute("data-lane", "auto");
    expect(chip("company:acme:autoFixCi")).toHaveAttribute("data-lane", "manual");
    // global row: five locked chips in the Manuál lane (global is all-off), explained
    expect(chip("global:autoReview")).toHaveAttribute("aria-disabled", "true");
    expect(chip("global:autoReview")).toHaveAttribute("data-lane", "manual");
    expect(screen.getByTestId(AutonomyMatrixTestId.GlobalNote)).toBeInTheDocument();
    // level off: Automat lane is capped, Manuál is disabled
    expect(screen.getByTestId(AutonomyScreenTestId.CapNote)).toHaveTextContent(
      "Teď jako Poloautomat",
    );
    expect(screen.getByTestId("zibby-mode-card-manual")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("zibby-mode-card-semi")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId(AutonomyScreenTestId.Unlock)).toBeNull();
  });

  it("is read-only without a token and unlocks by saving one", async () => {
    localStorage.removeItem(OPERATOR_TOKEN_STORAGE_KEY);
    renderAutonomy(<AutonomyScreen />);
    expect(screen.getByTestId(AutonomyScreenTestId.Unlock)).toBeInTheDocument();
    expect(chip("company:acme:autoFixCi")).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(chip("company:acme:autoFixCi"), { key: "ArrowRight" });
    expect(save).not.toHaveBeenCalled();
    await userEvent.type(screen.getByTestId(AutonomyScreenTestId.UnlockInput), "zby_op_new");
    await userEvent.click(screen.getByTestId(AutonomyScreenTestId.UnlockSave));
    expect(localStorage.getItem(OPERATOR_TOKEN_STORAGE_KEY)).toBe("zby_op_new");
    await waitFor(() => expect(screen.queryByTestId(AutonomyScreenTestId.Unlock)).toBeNull());
  });

  it("moves a chip with the arrow keys (Manuál <-> Automat), saves, toasts and undoes", async () => {
    renderAutonomy(<AutonomyScreen />);
    const target = chip("company:acme:autoFixCi");
    fireEvent.keyDown(target, { key: "ArrowLeft" }); // already Manuál: stays
    expect(save).not.toHaveBeenCalled();
    fireEvent.keyDown(target, { key: "ArrowRight" });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const next = save.mock.calls[0]?.[0];
    expect(next.companies.acme).toEqual({ autoReview: true, autoFixCi: true });
    expect(next.global).toEqual(NO_AUTOMATION);
    const toast = await screen.findByTestId(AutonomyScreenTestId.Toast);
    expect(toast).toHaveTextContent("Automat");
    await userEvent.click(within(toast).getByRole("button"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]?.[0].companies.acme).toEqual({ autoReview: true });
  });

  it("moves a chip with drag and drop within its own row only", async () => {
    renderAutonomy(<AutonomyScreen />);
    const web = chip("team:web:autoCommunicate");
    const webAuto = within(web.closest("tr") as HTMLElement)
      .getAllByTestId(AutonomyMatrixTestId.Lane)
      .find((l) => l.getAttribute("data-lane") === "auto") as HTMLElement;
    fireEvent.dragStart(web, { dataTransfer: { setData: vi.fn(), effectAllowed: "" } });
    fireEvent.dragOver(webAuto);
    fireEvent.drop(webAuto);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].teams.web).toEqual({ autoCommunicate: true });
  });

  it("offers inherit in the click menu and 'Dědit vše' for an overridden row", async () => {
    renderAutonomy(<AutonomyScreen />);
    await userEvent.click(chip("company:acme:autoReview"));
    // Poloautomat is not representable per capability: disabled target with its own note
    expect(screen.getByRole("menuitem", { name: /Poloautomat/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /Manuál/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Dědit z/ }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].companies).toEqual({});
    await userEvent.click(screen.getByTestId(AutonomyMatrixTestId.InheritAll));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });

  it("shows a failure toast when the save is locked", async () => {
    save.mockResolvedValue("locked");
    renderAutonomy(<AutonomyScreen />);
    fireEvent.keyDown(chip("company:acme:autoFixCi"), { key: "ArrowRight" });
    expect(await screen.findByTestId(AutonomyScreenTestId.Toast)).toHaveTextContent("token");
  });
});
