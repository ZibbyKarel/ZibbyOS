import type { DepartmentId, MemoryGraph, MemoryTier } from "@zibby/contracts";
import { groupVaultNodes } from "./groupVault";

/** Source id of the ZibbyOS vault; a team KB's source id is its team id. */
export const VAULT_SOURCE_ID = "vault";
/** The synthetic "Index" hub node every source hangs off. */
export const HUB_ID = "index";
/** Id prefix of a synthetic "Most · <KB>" bridge node between the Index hub and a team KB. */
export const BRIDGE_PREFIX = "bridge:";
/** The synthetic Index hub or a bridge — structural nodes, never notes. */
export const isStructural = (id: string) => id === HUB_ID || id.startsWith(BRIDGE_PREFIX);

export interface BrainSource {
  id: string;
  kind: "vault" | "kb";
  name: string;
}

export interface BrainNode {
  /** `<sourceId>:<localId>` — unique across sources (the hub is just `index`). */
  id: string;
  localId: string;
  sourceId: string;
  label: string;
  tier?: MemoryTier;
  department?: DepartmentId;
  /** Unsorted "halda": a vault note flagged raw, or a team KB note under `inbox/`. */
  raw?: boolean;
  /** A team KB note that carries an open question (digest). */
  open?: boolean;
  hub?: boolean;
  /** Set on a "Most · <KB>" bridge node: the team KB source it links to. */
  bridgeOf?: string;
}

export interface BrainGraphData {
  nodes: BrainNode[];
  edges: { from: string; to: string }[];
}

export const brainId = (sourceId: string, localId: string) => `${sourceId}:${localId}`;

/** Split a unified id at the first colon; null for the hub or a malformed id. */
export function parseBrainId(id: string): { sourceId: string; localId: string } | null {
  const i = id.indexOf(":");
  if (i <= 0 || i === id.length - 1) return null;
  return { sourceId: id.slice(0, i), localId: id.slice(i + 1) };
}

export interface BrainInput {
  vault?: MemoryGraph;
  kbs: { teamId: string; name?: string; graph?: MemoryGraph }[];
  /** Unified ids of notes with an open question. */
  openIds?: ReadonlySet<string>;
}

/**
 * Merge the vault graph and every team KB graph into one: ids are prefixed by source, and a
 * synthetic Index hub links to the best-connected note of each source (its entry point).
 * Edges to notes missing from their own graph are dropped. Pure.
 */
export function buildBrainGraph({ vault, kbs, openIds }: BrainInput): BrainGraphData {
  const nodes: BrainNode[] = [];
  const edges: BrainGraphData["edges"] = [];
  const roots: { sourceId: string; id: string; name?: string }[] = [];

  const add = (sourceId: string, graph: MemoryGraph, withTiers: boolean, name?: string) => {
    const ids = new Set<string>();
    const degree = new Map<string, number>();
    for (const n of graph.nodes) {
      const id = brainId(sourceId, n.id);
      ids.add(id);
      nodes.push({
        id,
        localId: n.id,
        sourceId,
        label: n.label,
        ...(withTiers ? { tier: n.tier, department: n.department } : {}),
        ...(openIds?.has(id) ? { open: true } : {}),
        ...(n.raw ? { raw: true } : {}),
      });
    }
    for (const e of graph.edges) {
      const from = brainId(sourceId, e.from);
      const to = brainId(sourceId, e.to);
      if (!ids.has(from) || !ids.has(to)) continue;
      edges.push({ from, to });
      degree.set(from, (degree.get(from) ?? 0) + 1);
      degree.set(to, (degree.get(to) ?? 0) + 1);
    }
    const root = [...ids].sort(
      (a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a.localeCompare(b),
    )[0];
    if (root) roots.push({ sourceId, id: root, name });
  };

  if (vault) add(VAULT_SOURCE_ID, vault, true);
  for (const kb of kbs) if (kb.graph) add(kb.teamId, kb.graph, false, kb.name);

  if (nodes.length > 0) {
    nodes.unshift({ id: HUB_ID, localId: HUB_ID, sourceId: HUB_ID, label: "Index", hub: true });
    for (const r of roots) {
      if (r.sourceId === VAULT_SOURCE_ID) {
        edges.push({ from: HUB_ID, to: r.id });
        continue;
      }
      // a team KB hangs off the hub through its own "Most · <KB>" bridge node
      const bridge = `${BRIDGE_PREFIX}${r.sourceId}`;
      nodes.push({
        id: bridge,
        localId: bridge,
        sourceId: HUB_ID,
        label: `Most · ${r.name ?? r.sourceId}`,
        hub: true,
        bridgeOf: r.sourceId,
      });
      edges.push({ from: HUB_ID, to: bridge }, { from: bridge, to: r.id });
    }
  }
  return { nodes, edges };
}

export interface BrainFilter {
  /** Visible sources; null = all. */
  sources: ReadonlySet<string> | null;
  /** Visible vault tiers; null = all (KB notes have no tier and always pass). */
  tiers: ReadonlySet<MemoryTier> | null;
  /** Vault department shelf; null = all. */
  department: DepartmentId | null;
  /** Only notes without any link (hub edges do not count). */
  orphansOnly: boolean;
  /** Only unsorted ("Neroztříděné") notes. */
  unsortedOnly: boolean;
}

export const NO_FILTER: BrainFilter = {
  sources: null,
  tiers: null,
  department: null,
  orphansOnly: false,
  unsortedOnly: false,
};

export const isFiltering = (f: BrainFilter) =>
  f.sources !== null ||
  f.tiers !== null ||
  f.department !== null ||
  f.orphansOnly ||
  f.unsortedOnly;

/** Apply the filter; the hub stays while any note does, and edges follow their endpoints. Pure. */
export function filterBrain(graph: BrainGraphData, f: BrainFilter): BrainGraphData {
  if (!isFiltering(f)) return graph;
  const linked = new Set<string>();
  for (const e of graph.edges) {
    if (isStructural(e.from) || isStructural(e.to)) continue;
    linked.add(e.from);
    linked.add(e.to);
  }
  const keep = graph.nodes.filter((n) => {
    if (n.bridgeOf) return !f.sources || f.sources.has(n.bridgeOf);
    if (n.hub) return true;
    if (f.sources && !f.sources.has(n.sourceId)) return false;
    if (f.tiers && n.tier && !f.tiers.has(n.tier)) return false;
    if (f.department && n.sourceId === VAULT_SOURCE_ID && n.department !== f.department)
      return false;
    if (f.orphansOnly && linked.has(n.id)) return false;
    if (f.unsortedOnly && !n.raw) return false;
    return true;
  });
  const ids = new Set(keep.map((n) => n.id));
  const notes = keep.filter((n) => !n.hub);
  return {
    nodes: notes.length > 0 ? keep : [],
    edges: notes.length > 0 ? graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)) : [],
  };
}

/** Notes whose title or id contains `query` (case-insensitive). Empty query → null (no search). */
export function matchTitles(graph: BrainGraphData, query: string): Set<string> | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return new Set(
    graph.nodes
      .filter(
        (n) => !n.hub && (n.label.toLowerCase().includes(q) || n.localId.toLowerCase().includes(q)),
      )
      .map((n) => n.id),
  );
}

/** Where the legacy `/knowledge/vault|graph?source=…&note=…` links point now. */
export function legacyBrainNote(source: string | null, note: string | null): string | null {
  if (!note) return null;
  const team = source?.startsWith("team:") ? source.slice("team:".length) : null;
  return brainId(team || VAULT_SOURCE_ID, note);
}

export interface BrainTreeNode {
  id: string;
  label: string;
  sourceId: string;
  /** Present on branches (even empty); absent on notes. */
  children?: BrainTreeNode[];
  /** Notes below this branch. */
  count: number;
}

export interface BrainTreeLabels {
  tier: (tier: MemoryTier) => string;
  /** Department shelf name; null = the general shelf. */
  shelf: (department: DepartmentId | null) => string;
  /** KB folder name ("" = notes at the KB root, shown directly under the source). */
  sourceName: (sourceId: string) => string;
}

export const treeBranchId = (...parts: string[]) => `tree:${parts.join(":")}`;

/**
 * The text twin of the graph: Vault → tier → department shelf → notes, and each team KB →
 * top folder → notes. Built from the (already filtered) nodes, so the tree and the graph
 * always show the same notes. The Index root is the caller's wrapper. Pure.
 */
export function buildBrainTree(graph: BrainGraphData, labels: BrainTreeLabels): BrainTreeNode[] {
  const out: BrainTreeNode[] = [];
  const note = (n: BrainNode): BrainTreeNode => ({
    id: n.id,
    label: n.label,
    sourceId: n.sourceId,
    count: 1,
  });

  const vaultNodes = graph.nodes.filter((n) => n.sourceId === VAULT_SOURCE_ID);
  if (vaultNodes.length > 0) {
    const byId = new Map(vaultNodes.map((n) => [n.localId, n]));
    const tiers = groupVaultNodes(
      vaultNodes.flatMap((n) =>
        n.tier ? [{ id: n.localId, label: n.label, tier: n.tier, department: n.department }] : [],
      ),
    ).map((g) => {
      const shelves = g.shelves.map((s) => {
        const children = s.notes.flatMap((x) => {
          const n = byId.get(x.id);
          return n ? [note(n)] : [];
        });
        return {
          id: treeBranchId(VAULT_SOURCE_ID, g.tier, s.department ?? "general"),
          label: labels.shelf(s.department),
          sourceId: VAULT_SOURCE_ID,
          children,
          count: children.length,
        };
      });
      return {
        id: treeBranchId(VAULT_SOURCE_ID, g.tier),
        label: labels.tier(g.tier),
        sourceId: VAULT_SOURCE_ID,
        children: shelves,
        count: shelves.reduce((a, s) => a + s.count, 0),
      };
    });
    out.push({
      id: treeBranchId(VAULT_SOURCE_ID),
      label: labels.sourceName(VAULT_SOURCE_ID),
      sourceId: VAULT_SOURCE_ID,
      children: tiers,
      count: vaultNodes.length,
    });
  }

  const kbIds = [
    ...new Set(
      graph.nodes.filter((n) => !n.hub && n.sourceId !== VAULT_SOURCE_ID).map((n) => n.sourceId),
    ),
  ];
  for (const sourceId of kbIds) {
    const notes = graph.nodes.filter((n) => n.sourceId === sourceId);
    const root: BrainTreeNode[] = [];
    const folders = new Map<string, BrainTreeNode>();
    for (const n of [...notes].sort((a, b) => a.label.localeCompare(b.label))) {
      const slash = n.localId.indexOf("/");
      if (slash < 0) {
        root.push(note(n));
        continue;
      }
      const folder = n.localId.slice(0, slash);
      let f = folders.get(folder);
      if (!f) {
        f = { id: treeBranchId(sourceId, folder), label: folder, sourceId, children: [], count: 0 };
        folders.set(folder, f);
      }
      f.children?.push(note(n));
      f.count += 1;
    }
    const sorted = [...folders.values()].sort((a, b) => a.label.localeCompare(b.label));
    out.push({
      id: treeBranchId(sourceId),
      label: labels.sourceName(sourceId),
      sourceId,
      children: [...sorted, ...root],
      count: notes.length,
    });
  }
  return out;
}

/** Every branch id of a tree — "expand all" while a search is active. */
export function branchIds(nodes: readonly BrainTreeNode[]): string[] {
  return nodes.flatMap((n) => (n.children ? [n.id, ...branchIds(n.children)] : []));
}

/** Ids of the branches leading to `id` (outermost first); empty when `id` is not in the tree. */
export function branchPathTo(nodes: readonly BrainTreeNode[], id: string): string[] {
  for (const n of nodes) {
    if (n.id === id) return [];
    if (n.children) {
      const sub = branchPathTo(n.children, id);
      if (sub.length > 0 || n.children.some((c) => c.id === id)) return [n.id, ...sub];
    }
  }
  return [];
}

/** Wikilink target → repo-relative KB id, by exact path, extensionless path or basename. */
export function resolveWikilink(link: string, ids: readonly string[]): string | undefined {
  const norm = link.replace(/\.md$/, "");
  return (
    ids.find((id) => id.replace(/\.md$/, "") === norm) ??
    ids.find((id) => id.replace(/\.md$/, "").split("/").pop() === norm)
  );
}
