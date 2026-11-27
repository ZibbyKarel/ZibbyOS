import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorSchema } from "../common.schema";
import {
  ConnectedServiceSchema,
  CreateConnectedServiceSchema,
  UpdateConnectedServiceSchema,
} from "./connected-service.schema";

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
    createConnectedService: {
      method: "POST",
      path: "/connected-services",
      body: CreateConnectedServiceSchema,
      responses: { 201: ConnectedServiceSchema, 409: ErrorSchema },
      summary: "Add a connected service (writes its definition and its Playwright MCP server file)",
    },
    updateConnectedService: {
      method: "PATCH",
      path: "/connected-services/:id",
      body: UpdateConnectedServiceSchema,
      responses: { 200: ConnectedServiceSchema, 404: ErrorSchema },
      summary: "Edit a service's name, URLs, icon or auth cookies (id and profile stay)",
    },
    deleteConnectedService: {
      method: "DELETE",
      path: "/connected-services/:id",
      body: c.noBody(),
      responses: { 204: c.noBody(), 404: ErrorSchema },
      summary:
        "Remove a service's definition and the MCP server file it generated (the browser profile stays)",
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
