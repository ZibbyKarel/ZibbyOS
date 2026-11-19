import type { ReactElement } from "react";
import { NextIntlClientProvider } from "next-intl";
import { renderWithProviders, screen } from "../../test/render";
import csMessages from "../../i18n/messages/cs.json";
import { UnsavedBarTestId } from "@zibby/design-system";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@zibby/contracts";
import { OperatorTokenNoticeTestId } from "../ai-providers";
import { AgentDetailScreenTestId, DetailScreen } from "./DetailScreen";

function render(ui: ReactElement) {
  const messages = csMessages;
  return renderWithProviders(
    <NextIntlClientProvider locale="cs" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const AGENT: Agent = {
  id: "koder",
  name: "Kodér",
  description: "Use this agent when coding",
  model: "sonnet",
  thinking: "medium",
  tools: ["read"],
  category: "Dev",
  instructions: "Write the code.",
};

const { hooks } = vi.hoisted(() => ({
  hooks: {
    agent: {
      data: undefined as Agent | undefined,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    },
    update: vi.fn(),
    create: vi.fn(),
    del: vi.fn(),
    openNewTask: vi.fn(),
  },
}));

vi.mock("./queries", () => ({
  useAgentQuery: () => hooks.agent,
  useAgentsQuery: () => ({ data: [] }),
  useCategoriesQuery: () => ({ data: [{ name: "Dev", glyph: "code" }] }),
}));
vi.mock("./mutations", () => ({
  useCreateAgentMutation: () => ({ mutate: hooks.create, isPending: false }),
  useUpdateAgentMutation: () => ({ mutate: hooks.update, isPending: false }),
  useDeleteAgentMutation: () => ({ mutate: hooks.del, isPending: false }),
}));
vi.mock("../runs", () => ({ useRunsQuery: () => ({ runs: [], isPending: false }) }));
vi.mock("../pins", () => ({ PinButton: () => null }));
vi.mock("../workflows", () => ({
  useWorkflowsQuery: () => ({
    data: [{ id: "delivery", name: "Delivery", phases: [{ id: "p1", agent: "koder" }] }],
  }),
}));
vi.mock("../tasks", () => ({ useNewTask: () => ({ open: hooks.openNewTask }) }));
vi.mock("../gates", () => ({
  useGateRulesQuery: () => ({ data: [] }),
  useSystemPolicyQuery: () => ({ data: [] }),
}));

describe("agents DetailScreen (N4c grammar)", () => {
  beforeEach(() => {
    push.mockClear();
    hooks.update.mockClear();
    hooks.del.mockClear();
    hooks.openNewTask.mockClear();
    hooks.agent = { data: AGENT, isPending: false, isError: false, refetch: vi.fn() };
  });

  it("header carries the actions; Save is inert until something changes", () => {
    render(<DetailScreen agentId="koder" />);
    expect(screen.getByTestId(AgentDetailScreenTestId.Run)).toBeInTheDocument();
    expect(screen.getByTestId(AgentDetailScreenTestId.Delete)).toBeInTheDocument();
    expect(screen.getByTestId(AgentDetailScreenTestId.Save)).toBeDisabled();
    expect(screen.queryByTestId(UnsavedBarTestId.Root)).toBeNull();
  });

  it("editing instructions raises the unsaved bar; Discard restores it", async () => {
    render(<DetailScreen agentId="koder" />);
    const box = screen.getByRole("textbox", { name: /Instrukce agenta/ });
    await userEvent.type(box, " more");
    expect(await screen.findByTestId(UnsavedBarTestId.Root)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(UnsavedBarTestId.Discard));
    expect(screen.queryByTestId(UnsavedBarTestId.Root)).toBeNull();
  });

  it("the Preview toggle swaps the editor for rendered markdown", async () => {
    render(<DetailScreen agentId="koder" />);
    await userEvent.click(screen.getByTestId("segmented-control-item-pv"));
    expect(screen.getByTestId(AgentDetailScreenTestId.Preview)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Instrukce agenta/ })).toBeNull();
  });

  it("Save submits the form to the update mutation", async () => {
    render(<DetailScreen agentId="koder" />);
    await userEvent.type(screen.getByRole("textbox", { name: /Instrukce agenta/ }), "!");
    await userEvent.click(screen.getByTestId(AgentDetailScreenTestId.Save));
    await vi.waitFor(() => {
      expect(hooks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: "koder" },
          body: expect.objectContaining({ instructions: "Write the code.!", engine: null }),
        }),
        expect.any(Object),
      );
    });
  });

  it("a 401 on save shows the operator-token notice and snaps the engine back", async () => {
    hooks.update.mockImplementation((_args, opts?: { onError?: (e: unknown) => void }) =>
      opts?.onError?.({ status: 401 }),
    );
    render(<DetailScreen agentId="koder" />);
    await userEvent.click(screen.getByTestId("button-group-option-opencode"));
    expect(screen.getByTestId("button-group-option-opencode")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByTestId(AgentDetailScreenTestId.Save));
    expect(await screen.findByTestId(OperatorTokenNoticeTestId.Root)).toBeInTheDocument();
    expect(screen.getByTestId(OperatorTokenNoticeTestId.Link)).toHaveAttribute(
      "href",
      "/system/settings/general",
    );
    expect(screen.getByTestId("button-group-option-global")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("Delete asks in a CONFIRM dialog, then deletes and navigates back to the registry", async () => {
    hooks.del.mockImplementation((_args, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    render(<DetailScreen agentId="koder" />);
    await userEvent.click(screen.getByTestId(AgentDetailScreenTestId.Delete));
    expect(screen.getByTestId(AgentDetailScreenTestId.DeleteBreaks)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Smazat agenta" }));
    expect(hooks.del).toHaveBeenCalledWith(
      { params: { id: "koder" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(push).toHaveBeenCalledWith("/workforce/agents");
  });

  it("Run pre-fills the New Task dialog with the agent as explicit target", async () => {
    render(<DetailScreen agentId="koder" />);
    await userEvent.click(screen.getByTestId(AgentDetailScreenTestId.Run));
    expect(hooks.openNewTask).toHaveBeenCalledWith(undefined, {
      kind: "agent",
      id: "koder",
      name: "Kodér",
      glyph: "bot",
    });
  });
});
