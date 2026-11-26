import { z } from "zod";

export const ConnectedServiceStatusSchema = z.enum(["connected", "disconnected"]);

/** A website ZIBBY's agents drive through a persistent browser profile the operator signs into once. */
export const ConnectedServiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  landingUrl: z.string().url(),
  loginUrl: z.string().url(),
  /** Row icon; absent = the UI uses the landing page's favicon. */
  iconUrl: z.string().url().optional(),
  profile: z.string().min(1),
  status: ConnectedServiceStatusSchema,
});
export type ConnectedService = z.infer<typeof ConnectedServiceSchema>;

/** The name must slug to a non-empty id (`[a-z0-9-]`). */
const ServiceNameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/[A-Za-z0-9]/, "name needs a letter or digit");

/** `POST /connected-services` — `id`/`profile` derive from the name, `landingUrl` defaults to the login URL's origin. */
export const CreateConnectedServiceSchema = z.object({
  name: ServiceNameSchema,
  loginUrl: z.string().url(),
  landingUrl: z.string().url().optional(),
  iconUrl: z.string().url().optional(),
});
export type CreateConnectedService = z.infer<typeof CreateConnectedServiceSchema>;

/** `PATCH /connected-services/:id` — `iconUrl: null` clears the icon (back to the favicon). */
export const UpdateConnectedServiceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  loginUrl: z.string().url().optional(),
  landingUrl: z.string().url().optional(),
  iconUrl: z.string().url().nullable().optional(),
});
export type UpdateConnectedService = z.infer<typeof UpdateConnectedServiceSchema>;
