import { initContract } from "@ts-rest/core";
import { EmptyBodySchema, ErrorSchema } from "../common.schema";
import { BriefingSchema, DayOverviewSchema, GenerateBriefingResultSchema } from "./briefing.schema";

const c = initContract();

/**
 * Briefing (Phase 6.2). `GET` is a PURE read — it assembles the current briefing
 * from the record with zero side effects (the overview card calls this). `POST
 * /generate` is the only mutating route: it assembles, runs the optional
 * butler-voice pass, persists the prose to the vault, advances the cursor and
 * records a `briefing-generated` activity entry. The morning automation drives the
 * same `generate` path server-side.
 */
export const briefingContract = c.router(
  {
    getBriefing: {
      method: "GET",
      path: "/briefing",
      responses: { 200: BriefingSchema },
      summary: "Assemble the current briefing (pure read, no persistence)",
    },
    generateBriefing: {
      method: "POST",
      path: "/briefing/generate",
      body: EmptyBodySchema,
      responses: { 201: GenerateBriefingResultSchema },
      summary: "Generate, persist to the vault, and record a briefing",
    },
    getDayOverview: {
      method: "GET",
      path: "/briefing/day",
      // 503: no cached text for today and the model could not write one.
      responses: { 200: DayOverviewSchema, 503: ErrorSchema },
      summary: "Today's short text overview (cached per day; written on first read of the day)",
    },
    refreshDayOverview: {
      method: "POST",
      path: "/briefing/day/refresh",
      body: EmptyBodySchema,
      responses: { 200: DayOverviewSchema, 503: ErrorSchema },
      summary: "Rewrite today's text overview now",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);
export type BriefingContract = typeof briefingContract;
