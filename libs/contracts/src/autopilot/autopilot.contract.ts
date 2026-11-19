import { initContract } from "@ts-rest/core";
import { ErrorSchema } from "../common.schema";
import { AutopilotStatusSchema, SetAutopilotInputSchema } from "./autopilot.schema";

const c = initContract();

/**
 * Autonomy levels and the pause switch. Resuming and raising any cell need the operator token
 * (401 without); pausing and lowering never do — tightening is always allowed, so the operator
 * chat can pause too (Law 4: nothing but the token can widen what ZIBBY does alone).
 */
export const autopilotContract = c.router(
  {
    getAutopilot: {
      method: "GET",
      path: "/autopilot",
      responses: { 200: AutopilotStatusSchema },
      summary: "Autonomy levels, paused, since when, by whom, and the pending approvals count",
    },
    setAutopilot: {
      method: "PUT",
      path: "/autopilot",
      body: SetAutopilotInputSchema,
      responses: { 200: AutopilotStatusSchema, 401: ErrorSchema },
      summary: "Pause/resume and set autonomy levels (resume and raise need the operator token)",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);

export type AutopilotContract = typeof autopilotContract;
