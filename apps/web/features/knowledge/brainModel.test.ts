import { describe, expect, it } from "vitest";
import type { MemoryGraph } from "@zibby/contracts";
import {
  HUB_ID,
  NO_FILTER,
  brainId,
  branchIds,
  branchPathTo,
  buildBrainGraph,
  buildBrainTree,
  filterBrain,
  isFiltering,
  legacyBrainNote,
  matchTitles,
  parseBrainId,
  resolveWikilink,
} from "./brainModel";

const vault: MemoryGraph = {
  nodes: [
    { id: "north-star", label: "North Star", tier: "memory" },
    { id: "log", label: "Daily log", tier: "daily" },
    { id: "lonely", label: "Lonely", tier: "knowledge", department: "knw" as never },
  ],
  edges: [
    { from: "north-star", to: "log" },
    { from: "log", to: "ghost" },
  ],
};
const kb: MemoryGraph = {
  nodes: [
    { id: "meetings/kickoff.md", label: "Kickoff", tier: "knowledge" },
    { id: "readme.md", label: "Readme", tier: "knowledge" },
  ],
  edges: [{ from: "readme.md", to: "meetings/kickoff.md" }],
};

const build = () =>
  buildBrainGraph({
    vault,
    kbs: [{ teamId: "devrel", name: "DevRel KB", graph: kb }],
    openIds: new Set([brainId("devrel", "readme.md")]),
  });

describe("buildBrainGraph", () => {
  it("prefixes ids by source, flags open questions, drops dangling edges", () => {
    const g = build();
    expect(g.nodes.map((n) => n.id)).toContain("vault:north-star");
    expect(g.nodes.map((n) => n.id)).toContain("devrel:meetings/kickoff.md");
    expect(g.nodes.find((n) => n.id === "devrel:readme.md")?.open).toBe(true);
    expect(g.edges).not.toContainEqual({ from: "vault:log", to: "vault:ghost" });
  });

  it("links the hub to the vault root and, through a bridge node, to each team KB root", () => {
    const g = build();
    const hubTargets = g.edges.filter((e) => e.from === HUB_ID).map((e) => e.to);
    expect(hubTargets).toHaveLength(2);
    expect(hubTargets).toContain("vault:log"); // degree tie, alphabetical
    expect(hubTargets).toContain("bridge:devrel");
    const bridge = g.nodes.find((n) => n.id === "bridge:devrel");
    expect(bridge).toMatchObject({ hub: true, bridgeOf: "devrel", label: "Most · DevRel KB" });
    expect(g.edges.filter((e) => e.from === "bridge:devrel")).toHaveLength(1);
  });

  it("has no hub for an empty brain", () => {
    expect(buildBrainGraph({ kbs: [] }).nodes).toEqual([]);
  });
});

describe("filterBrain", () => {
  it("returns the same graph without a filter", () => {
    const g = build();
    expect(filterBrain(g, NO_FILTER)).toBe(g);
  });

  it("filters by source and keeps edges consistent", () => {
    const g = filterBrain(build(), { ...NO_FILTER, sources: new Set(["devrel"]) });
    expect(g.nodes.filter((n) => !n.hub).every((n) => n.sourceId === "devrel")).toBe(true);
    expect(g.edges.every((e) => g.nodes.some((n) => n.id === e.from))).toBe(true);
  });

  it("filters vault tiers but lets tier-less KB notes through", () => {
    const g = filterBrain(build(), { ...NO_FILTER, tiers: new Set(["memory"]) });
    const ids = g.nodes.map((n) => n.id);
    expect(ids).toContain("vault:north-star");
    expect(ids).not.toContain("vault:log");
    expect(ids).toContain("devrel:readme.md");
  });

  it("keeps only orphans and drops everything when none match", () => {
    const g = filterBrain(build(), { ...NO_FILTER, orphansOnly: true });
    expect(g.nodes.filter((n) => !n.hub).map((n) => n.id)).toEqual(["vault:lonely"]);
    const none = filterBrain(
      buildBrainGraph({
        vault: {
          nodes: [
            { id: "a", label: "A", tier: "memory" },
            { id: "b", label: "B", tier: "memory" },
          ],
          edges: [{ from: "a", to: "b" }],
        },
        kbs: [],
      }),
      { ...NO_FILTER, orphansOnly: true },
    );
    expect(none.nodes).toEqual([]);
  });
});

describe("unsorted (raw) notes", () => {
  const graph = () =>
    buildBrainGraph({
      vault: {
        nodes: [
          { id: "heap", label: "Heap", tier: "knowledge", raw: true },
          { id: "sorted", label: "Sorted", tier: "memory" },
        ],
        edges: [],
      },
      kbs: [
        {
          teamId: "devrel",
          graph: {
            nodes: [
              { id: "inbox/q.md", label: "Q", tier: "knowledge", raw: true },
              { id: "wiki/a.md", label: "A", tier: "knowledge" },
            ],
            edges: [],
          },
        },
      ],
    });

  it("carries raw onto graph nodes from both sources", () => {
    const raw = graph()
      .nodes.filter((n) => n.raw)
      .map((n) => n.id);
    expect(raw.sort()).toEqual(["devrel:inbox/q.md", "vault:heap"]);
  });

  it("unsortedOnly keeps just the raw notes", () => {
    const g = filterBrain(graph(), { ...NO_FILTER, unsortedOnly: true });
    expect(
      g.nodes
        .filter((n) => !n.hub)
        .map((n) => n.id)
        .sort(),
    ).toEqual(["devrel:inbox/q.md", "vault:heap"]);
    expect(isFiltering({ ...NO_FILTER, unsortedOnly: true })).toBe(true);
  });
});

describe("helpers", () => {
  it("parses unified ids at the first colon", () => {
    expect(parseBrainId("devrel:a/b:c.md")).toEqual({ sourceId: "devrel", localId: "a/b:c.md" });
    expect(parseBrainId("index")).toBeNull();
  });

  it("matches titles and ids case-insensitively, null for an empty query", () => {
    const g = build();
    expect(matchTitles(g, "  ")).toBeNull();
    expect([...(matchTitles(g, "KICK") ?? [])]).toEqual(["devrel:meetings/kickoff.md"]);
  });

  it("maps legacy deep links to unified ids", () => {
    expect(legacyBrainNote(null, "north-star")).toBe("vault:north-star");
    expect(legacyBrainNote("team:devrel", "a.md")).toBe("devrel:a.md");
    expect(legacyBrainNote("team:devrel", null)).toBeNull();
  });
});

describe("buildBrainTree", () => {
  const tree = buildBrainTree(build(), {
    tier: (t) => `T:${t}`,
    shelf: (d) => `S:${d ?? "general"}`,
    sourceName: (s) => s,
  });

  it("nests the vault by tier then shelf and the KB by folder", () => {
    expect(tree.map((n) => n.id)).toEqual(["tree:vault", "tree:devrel"]);
    const kbRoot = tree[1];
    expect(kbRoot?.children?.map((c) => c.label)).toEqual(["meetings", "Readme"]);
    expect(kbRoot?.count).toBe(2);
    const memory = tree[0]?.children?.find((c) => c.id === "tree:vault:memory");
    expect(memory?.children?.[0]?.children?.[0]?.id).toBe("vault:north-star");
  });

  it("lists every branch id", () => {
    expect(branchIds(tree)).toContain("tree:devrel:meetings");
    expect(branchIds(tree)).not.toContain("vault:north-star");
  });

  it("finds the branch path to a note", () => {
    expect(branchPathTo(tree, "devrel:meetings/kickoff.md")).toEqual([
      "tree:devrel",
      "tree:devrel:meetings",
    ]);
    expect(branchPathTo(tree, "devrel:readme.md")).toEqual(["tree:devrel"]);
    expect(branchPathTo(tree, "nope")).toEqual([]);
  });
});

describe("resolveWikilink", () => {
  const ids = ["meetings/kickoff.md", "readme.md"];
  it("resolves by path, extensionless path or basename", () => {
    expect(resolveWikilink("meetings/kickoff", ids)).toBe("meetings/kickoff.md");
    expect(resolveWikilink("kickoff", ids)).toBe("meetings/kickoff.md");
    expect(resolveWikilink("missing", ids)).toBeUndefined();
  });
});
