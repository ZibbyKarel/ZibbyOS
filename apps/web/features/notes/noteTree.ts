import type { TreeNode } from "@zibby/design-system";

/** The tree node id of a folder (files use their vault path), so the two never collide. */
export const dirId = (path: string) => `dir:${path}`;

/**
 * Folder tree of vault-relative paths: folders first, then files, both A–Z. `decorate` adds
 * per-file node fields (row key, marker).
 */
export function buildNoteTree(
  paths: readonly string[],
  decorate: (path: string) => Partial<TreeNode>,
): TreeNode[] {
  type Dir = { dirs: Map<string, Dir>; files: string[] };
  const root: Dir = { dirs: new Map(), files: [] };
  for (const p of paths) {
    const parts = p.split("/");
    let cur = root;
    for (const part of parts.slice(0, -1)) {
      const next = cur.dirs.get(part) ?? { dirs: new Map(), files: [] };
      cur.dirs.set(part, next);
      cur = next;
    }
    cur.files.push(p);
  }
  const toNodes = (dir: Dir, prefix: string): TreeNode[] => [
    ...[...dir.dirs.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, sub]) => ({
        id: dirId(`${prefix}${name}`),
        label: name,
        children: toNodes(sub, `${prefix}${name}/`),
      })),
    ...dir.files
      .sort((a, b) => a.localeCompare(b))
      .map((p) => ({
        id: p,
        label: (p.split("/").pop() ?? p).replace(/\.md$/, ""),
        ...decorate(p),
      })),
  ];
  return toNodes(root, "");
}

/** Every folder id in a tree. */
export function branchIds(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((n) => (n.children ? [n.id, ...branchIds(n.children)] : []));
}
