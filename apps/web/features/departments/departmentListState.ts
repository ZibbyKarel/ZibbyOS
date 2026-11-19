import type { DepartmentState } from "@zibby/contracts";
import type { StateTone } from "@zibby/design-system";

/** Visual tone of a department's live state; an idle department shows no pill. */
export function departmentPillTone(state: DepartmentState): StateTone | undefined {
  switch (state) {
    case "running":
      return "working";
    case "waiting":
      return "blocked";
    case "error":
      return "error";
    case "report":
      return "done";
    case "idle":
      return undefined;
  }
}
