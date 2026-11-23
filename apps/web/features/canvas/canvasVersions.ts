import type { CanvasVersion } from "@zibby/contracts";

/**
 * Display labels of a canvas's versions: code versions are `v1, v2, …` (counted in order),
 * params versions `v<codeIdx>.<k>` (counted per base code version). Keyed by version number.
 */
export function canvasVersionLabels(versions: readonly CanvasVersion[]): Map<number, string> {
  const codeIdx = new Map<number, number>();
  const perBase = new Map<number, number>();
  const labels = new Map<number, string>();
  for (const v of versions) {
    if (v.kind !== "params") {
      codeIdx.set(v.version, codeIdx.size + 1);
      labels.set(v.version, `v${codeIdx.size}`);
      continue;
    }
    const base = v.base ?? 0;
    const k = (perBase.get(base) ?? 0) + 1;
    perBase.set(base, k);
    labels.set(v.version, `v${codeIdx.get(base) ?? "?"}.${k}`);
  }
  return labels;
}

/** The code version whose HTML version `n` renders (itself for code, `base` for params). */
export function codeVersionOf(versions: readonly CanvasVersion[], n: number): number | undefined {
  const v = versions.find((x) => x.version === n);
  if (!v) return undefined;
  return v.kind === "params" ? v.base : v.version;
}
