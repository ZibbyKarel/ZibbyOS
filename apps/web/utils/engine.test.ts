import { describe, expect, it } from "vitest";
import {
  catalogIds,
  engineMark,
  formatEngine,
  lacksThinkingVariant,
  stepEngineChoice,
  tierConcreteModel,
  workflowEngineMarks,
} from "./engine";

describe("tier helpers", () => {
  it("claude: the tier is the Claude model, mapping ignored", () => {
    expect(tierConcreteModel("opus", "claude", { opus: "x/y" }, "d/m")).toBe("Opus");
  });

  it("opencode: mapped tier, nearest lower, nearest higher, default, else empty", () => {
    const map = { sonnet: "a/sonnet", fable: "a/fable" };
    expect(tierConcreteModel("sonnet", "opencode", map, "d/m")).toBe("a/sonnet");
    expect(tierConcreteModel("opus", "opencode", map, "d/m")).toBe("a/sonnet");
    expect(tierConcreteModel("haiku", "opencode", { fable: "a/fable" }, "d/m")).toBe("a/fable");
    expect(tierConcreteModel("haiku", "opencode", {}, "d/m")).toBe("d/m");
    expect(tierConcreteModel("haiku", "opencode", {}, "")).toBe("");
  });

  it("tierConcreteModel falls back past a tier the catalog lacks", () => {
    const map = { opus: "a/o", fable: "a/f" };
    expect(tierConcreteModel("fable", "opencode", map, "g", ["a/o"])).toBe("a/o");
    expect(tierConcreteModel("fable", "claude", { opus: "a/o" }, "g", [])).toBe("Fable");
  });

  it("catalogIds is undefined for a missing or empty opencode catalog", () => {
    expect(catalogIds(undefined)).toBeUndefined();
    expect(catalogIds([{ id: "opencode", available: true, models: [] }])).toBeUndefined();
    expect(
      catalogIds([
        {
          id: "opencode",
          available: false,
          models: [{ id: "a/o", free: false, subscription: false, variants: [] }],
        },
      ]),
    ).toBeUndefined();
    expect(
      catalogIds([
        {
          id: "opencode",
          available: true,
          models: [{ id: "a/o", free: false, subscription: false, variants: [] }],
        },
      ]),
    ).toEqual(["a/o"]);
  });

  it("formatEngine is untouched", () => {
    expect(formatEngine("opencode", "p/m")).toBe("opencode · p/m");
  });
});

describe("lacksThinkingVariant", () => {
  const models = [
    { id: "a/think", variants: ["low", "high"] },
    { id: "a/plain", variants: [] },
  ];
  it("flags a known model without the level", () => {
    expect(lacksThinkingVariant(models, "a/plain", "high")).toBe(true);
    expect(lacksThinkingVariant(models, "a/think", "medium")).toBe(true);
  });
  it("does not flag a supported level, an explicit #variant, or an unknown/empty model", () => {
    expect(lacksThinkingVariant(models, "a/think", "high")).toBe(false);
    expect(lacksThinkingVariant(models, "a/plain#max", "high")).toBe(false);
    expect(lacksThinkingVariant(models, "x/gone", "high")).toBe(false);
    expect(lacksThinkingVariant(models, "", "high")).toBe(false);
  });
});

describe("stepEngineChoice", () => {
  const agent = { engine: "opencode", engineModel: "a/agent" } as const;
  it("step model beats the agent's, which beats nothing", () => {
    expect(stepEngineChoice({ engine: "opencode", engineModel: "a/step" }, agent).engineModel).toBe(
      "a/step",
    );
    expect(stepEngineChoice({}, agent)).toEqual({ engine: "opencode", engineModel: "a/agent" });
    expect(stepEngineChoice({}, { engine: "opencode" }).engineModel).toBeUndefined();
  });
  it("drops the exact model off opencode", () => {
    expect(stepEngineChoice({ engine: "claude" }, agent)).toEqual({
      engine: "claude",
      engineModel: undefined,
    });
    expect(stepEngineChoice({}, undefined).engine).toBeUndefined();
  });
});

describe("engineMark", () => {
  const config = {
    aiEngine: "opencode" as const,
    opencodeModel: "beam/free",
    opencodeTierModels: { sonnet: "openai/gpt-5", opus: "anthropic/opus" },
  };

  it("claude (override or global) → claude, whatever the model", () => {
    expect(engineMark({ engine: "claude", engineModel: "openai/x" }, config)).toBe("claude");
    expect(engineMark({}, { ...config, aiEngine: "claude" })).toBe("claude");
    expect(engineMark({}, undefined)).toBe("claude");
  });

  it("opencode: explicit engineModel decides", () => {
    expect(engineMark({ engine: "opencode", engineModel: "openai/gpt-5" }, config)).toBe("openai");
    expect(engineMark({ engineModel: "beam/free" }, config)).toBe("opencode");
  });

  it("opencode: the tier mapping decides without an engineModel", () => {
    expect(engineMark({ model: "sonnet" }, config)).toBe("openai");
    expect(engineMark({ model: "opus" }, config)).toBe("opencode");
    expect(engineMark({}, config)).toBe("openai");
  });

  it("opencode with nothing mapped → opencode", () => {
    expect(engineMark({ model: "haiku" }, { ...config, opencodeTierModels: {} })).toBe("opencode");
  });
});

describe("workflowEngineMarks", () => {
  const markOf = (t: { engine?: string; engineModel?: string }) =>
    engineMark(t as never, { aiEngine: "claude", opencodeModel: "", opencodeTierModels: {} });
  const agents = [{ id: "a", engine: "opencode", engineModel: "x/y" } as const];

  it("collects distinct marks in claude, openai, opencode order (global included)", () => {
    const steps = [
      { type: "agent", agent: "a" }, // agent's opencode
      { type: "agent", agent: "b", openaiModel: "gpt-5" }, // openai
      { type: "agent", agent: "b" }, // global claude
      { type: "tool" },
    ];
    expect(workflowEngineMarks(steps, agents, markOf)).toEqual(["claude", "openai", "opencode"]);
  });

  it("falls back to the global engine without agent steps", () => {
    expect(workflowEngineMarks([{ type: "tool" }], agents, markOf)).toEqual(["claude"]);
  });
});
