import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorSchema } from "../common.schema";
import { ConnectedServiceSchema } from "./connected-service.schema";

const c = initContract();

/**
 * Connected services — websites driven via per-service Chrome profiles. Status is
 * read from the profile's cookie DB (no browser launch); `connect` opens plain
 * system Chrome on the profile at the login URL so the operator can sign in.
 */
export const connectedServicesContract = c.router(
  {
    listConnectedServices: {
      method: "GET",
      path: "/connected-services",
      responses: { 200: z.array(ConnectedServiceSchema) },
      summary: "List connected services with their sign-in status",
    },
    connectService: {
      method: "POST",
      path: "/connected-services/:id/connect",
      body: c.noBody(),
      responses: { 200: ConnectedServiceSchema, 404: ErrorSchema },
      summary: "Open system Chrome on the service's profile at its login URL",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);
export type ConnectedServicesContract = typeof connectedServicesContract;
