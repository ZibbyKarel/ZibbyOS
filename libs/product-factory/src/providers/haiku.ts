import path from "node:path";
import { run as defaultRun } from "./proc.ts";
import type { Run } from "./proc.ts";
import { VerdictSchema, anatomyIssues, countIssues, judgeError, qaPrompt } from "./qa-prompt.ts";
import type { VisionProvider, VisionVerdict } from "./vision.ts";

/** claude -p envelope -> verdict. `result` holds the model text containing one ```json block (or raw JSON). */
export function parseEnvelope(
  stdout: string,
  expectedCounts: Record<string, number> = {},
  scene = "",
): {
  verdict: ReturnType<typeof judgeError> | { passed: boolean; issues: VisionVerdict["issues"] };
  cost: number;
} {
  let cost = 0;
  try {
    const env = JSON.parse(stdout) as { result?: string; total_cost_usd?: number };
    cost = env.total_cost_usd ?? 0;
    const text = env.result ?? "";
    const m = /```json[^\n]*\n([\s\S]*?)```/i.exec(text);
    const parsed = VerdictSchema.safeParse(JSON.parse(m ? (m[1] ?? "") : text));
    if (parsed.success) {
      const issues = [
        ...parsed.data.issues,
        ...countIssues(parsed.data.counts, expectedCounts),
        ...anatomyIssues(parsed.data.figures, scene),
      ];
      const passed = parsed.data.passed && issues.length === parsed.data.issues.length;
      return { verdict: { passed, issues }, cost };
    }
    return {
      verdict: judgeError(`haiku reply invalid: ${parsed.error.message.slice(0, 200)}`),
      cost,
    };
  } catch (e) {
    return { verdict: judgeError(`haiku reply unparsable: ${(e as Error).message}`), cost };
  }
}

export function createHaikuVisionProvider(
  env: NodeJS.ProcessEnv,
  run: Run = defaultRun,
): VisionProvider {
  const timeoutMs = Number(env.PF_HAIKU_TIMEOUT_MS) || 120_000;
  const model = env.PF_VISION_MODEL || "haiku";
  return {
    id: "haiku",
    model,
    async judge(input): Promise<VisionVerdict> {
      const t0 = performance.now();
      const prompt = `${qaPrompt(input)}\n\nUse the Read tool to view the image at ${input.file}${input.referenceImage ? ` (first image) and the reference sheet at ${input.referenceImage} (second image)` : ""} and judge it. Answer ONLY with one \`\`\`json block containing the JSON object, nothing else.`;
      // A hung judge must block the item (judge-error), not crash the whole cast/produce round.
      const r = await run(
        "claude",
        [
          "-p",
          "--model",
          model,
          "--output-format",
          "json",
          "--allowedTools",
          "Read",
          "--permission-mode",
          "dontAsk",
          "--no-session-persistence",
          "--setting-sources",
          "",
          "--add-dir",
          path.dirname(input.file),
          ...(input.referenceImage ? ["--add-dir", path.dirname(input.referenceImage)] : []),
        ],
        { stdin: prompt, timeoutMs },
      ).catch((e: unknown) => {
        // Only a timeout becomes a judge-error; a missing `claude` binary still fails fast.
        if (!(e instanceof Error) || !e.message.includes("timed out")) throw e;
        return { code: null, stdout: "", stderr: e.message };
      });
      const { verdict, cost } =
        r.code === 0
          ? parseEnvelope(r.stdout, input.characterCounts, input.scene)
          : { verdict: judgeError(`claude exited ${r.code}: ${r.stderr.slice(0, 200)}`), cost: 0 };
      return { ...verdict, durationMs: Math.round(performance.now() - t0), costUsd: cost };
    },
  };
}
