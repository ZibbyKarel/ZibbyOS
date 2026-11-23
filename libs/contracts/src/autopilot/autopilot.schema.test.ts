import { describe, expect, it } from "vitest";
import {
  AutomationLevelsSchema,
  type AutopilotAutomation,
  AutopilotStateSchema,
  NO_AUTOMATION,
  SetAutopilotInputSchema,
  migrateLegacyAutopilotState,
  resolveAutopilotAutomation,
  resolveAutopilotLevels,
} from "../index";

const tree: AutopilotAutomation = {
  global: {
    autoImplement: "auto",
    autoReview: "manual",
    autoAddressComments: "manual",
    autoCommunicate: "manual",
    autoFixCi: "manual",
  },
  companies: { shoptet: { autoReview: "auto" } },
  teams: { devrel: { autoReview: "manual", autoAddressComments: "semi" } },
};

describe("resolveAutopilotAutomation", () => {
  it("is not-manual per cell: semi and auto both start work", () => {
    const all = {
      autoImplement: "semi",
      autoReview: "auto",
      autoAddressComments: "semi",
      autoCommunicate: "auto",
      autoFixCi: "manual",
    } as const;
    expect(
      resolveAutopilotAutomation({ paused: false, automation: { ...tree, global: all } }, {}),
    ).toEqual({
      autoImplement: true,
      autoReview: true,
      autoAddressComments: true,
      autoCommunicate: true,
      autoFixCi: false,
    });
  });

  it("is all false while paused, whatever the cells say", () => {
    const all = {
      autoImplement: "auto",
      autoReview: "auto",
      autoAddressComments: "auto",
      autoCommunicate: "auto",
      autoFixCi: "auto",
    } as const;
    const out = resolveAutopilotAutomation(
      { paused: true, automation: { ...tree, global: all } },
      {},
    );
    expect(Object.values(out)).toEqual([false, false, false, false, false]);
    // The tri-state itself is untouched by the pause.
    expect(resolveAutopilotLevels({ automation: { ...tree, global: all } }, {}).autoReview).toBe(
      "auto",
    );
  });

  it("is all false without a tree", () => {
    expect(Object.values(resolveAutopilotAutomation({ paused: false }, {}))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("applies team > company > global", () => {
    const s = { paused: false, automation: tree };
    expect(resolveAutopilotLevels(s, { companyId: "shoptet", teamId: "devrel" })).toEqual({
      autoImplement: "auto",
      autoReview: "manual",
      autoAddressComments: "semi",
      autoCommunicate: "manual",
      autoFixCi: "manual",
    });
    expect(resolveAutopilotLevels(s, { companyId: "shoptet", teamId: "frontend" })).toEqual({
      autoImplement: "auto",
      autoReview: "auto",
      autoAddressComments: "manual",
      autoCommunicate: "manual",
      autoFixCi: "manual",
    });
    expect(resolveAutopilotLevels(s, { teamId: "gone" })).toEqual(tree.global);
  });
});

describe("autoFixCi", () => {
  it("defaults to manual for trees written without it, and is overridable per node", () => {
    const legacy: Record<string, string> = { ...NO_AUTOMATION };
    delete legacy.autoFixCi;
    expect(AutomationLevelsSchema.parse(legacy).autoFixCi).toBe("manual");
    const s = {
      paused: false,
      automation: { ...tree, companies: { shoptet: { autoFixCi: "auto" as const } } },
    };
    expect(resolveAutopilotLevels(s, {}).autoFixCi).toBe("manual");
    expect(resolveAutopilotLevels(s, { companyId: "shoptet" }).autoFixCi).toBe("auto");
  });
});

describe("autopilot state + input schemas", () => {
  it("parses a new state and defaults the maps", () => {
    expect(AutopilotStateSchema.parse({ paused: false })).toEqual({ paused: false });
    const parsed = AutopilotStateSchema.parse({
      paused: true,
      automation: { global: NO_AUTOMATION },
    });
    expect(parsed).toMatchObject({ paused: true });
    expect(parsed.automation).toEqual({ global: NO_AUTOMATION, companies: {}, teams: {} });
    expect(
      SetAutopilotInputSchema.safeParse({ paused: false, automation: { global: NO_AUTOMATION } })
        .success,
    ).toBe(true);
  });

  it("rejects unknown level cells and unknown keys", () => {
    expect(AutomationLevelsSchema.safeParse({ ...NO_AUTOMATION, sneaky: "auto" }).success).toBe(
      false,
    );
    expect(AutomationLevelsSchema.safeParse({ ...NO_AUTOMATION, autoReview: true }).success).toBe(
      false,
    );
  });
});

describe("legacy migration", () => {
  const legacyTree = (toggle: boolean) => ({
    global: {
      autoReview: toggle,
      autoAddressComments: false,
      autoImplement: toggle,
      autoCommunicate: false,
      autoFixCi: toggle,
    },
    companies: { shoptet: { autoReview: !toggle } },
    teams: {},
  });

  it("level full: true -> auto, false -> manual", () => {
    const s = AutopilotStateSchema.parse({ level: "full", automation: legacyTree(true) });
    expect(s.paused).toBe(false);
    expect(s.automation?.global).toEqual({
      autoReview: "auto",
      autoAddressComments: "manual",
      autoImplement: "auto",
      autoCommunicate: "manual",
      autoFixCi: "auto",
    });
    expect(s.automation?.companies).toEqual({ shoptet: { autoReview: "manual" } });
  });

  it("level off: true -> semi (it started work and waited), false -> manual", () => {
    const s = AutopilotStateSchema.parse({ level: "off", automation: legacyTree(true) });
    expect(s.automation?.global.autoReview).toBe("semi");
    expect(s.automation?.global.autoAddressComments).toBe("manual");
    expect(s.automation?.companies).toEqual({ shoptet: { autoReview: "manual" } });
  });

  it("takes autoCommunicate from the stored scope when the tree predates it", () => {
    const global: Record<string, unknown> = { ...legacyTree(true).global };
    delete global.autoCommunicate;
    const s = AutopilotStateSchema.parse({
      level: "full",
      scope: { reviews: true, comments: true, communication: true },
      automation: { global, companies: {}, teams: {} },
    });
    expect(s.automation?.global.autoCommunicate).toBe("auto");
    const off = AutopilotStateSchema.parse({
      level: "off",
      scope: { reviews: true, comments: true, communication: true },
      automation: { global, companies: {}, teams: {} },
    });
    expect(off.automation?.global.autoCommunicate).toBe("semi");
  });

  it("keeps since/by, and a legacy state without a tree has no tree (starts nothing)", () => {
    const s = AutopilotStateSchema.parse({
      level: "full",
      scope: { reviews: true, comments: true, communication: true },
      since: "2026-01-01T00:00:00.000Z",
      by: "operator",
    });
    expect(s).toEqual({ paused: false, since: "2026-01-01T00:00:00.000Z", by: "operator" });
    expect(Object.values(resolveAutopilotAutomation(s, {})).some(Boolean)).toBe(false);
  });

  it("leaves new-shape and non-object input untouched", () => {
    const fresh = { paused: true };
    expect(migrateLegacyAutopilotState(fresh)).toBe(fresh);
    expect(migrateLegacyAutopilotState("garbage")).toBe("garbage");
  });
});

describe("resolveAutopilotLevels copy", () => {
  it("returns a fresh object without a tree, never the shared constant", () => {
    const a = resolveAutopilotLevels({}, {});
    expect(a).toEqual(NO_AUTOMATION);
    expect(a).not.toBe(NO_AUTOMATION);
  });
});

describe("global all-manual", () => {
  it("is a master switch: company/team exceptions start nothing", () => {
    const s = {
      paused: false,
      automation: {
        global: { ...NO_AUTOMATION },
        companies: { shoptet: { autoReview: "auto" as const } },
        teams: { devrel: { autoReview: "semi" as const, autoFixCi: "auto" as const } },
      },
    };
    const at = { companyId: "shoptet", teamId: "devrel" };
    expect(resolveAutopilotLevels(s, at)).toEqual(NO_AUTOMATION);
    expect(Object.values(resolveAutopilotAutomation(s, at)).some(Boolean)).toBe(false);
  });
});
