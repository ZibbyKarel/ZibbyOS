import { z } from "zod";

export const ConnectedServiceStatusSchema = z.enum(["connected", "disconnected"]);

/** A website ZIBBY's agents drive through a persistent browser profile the operator signs into once. */
export const ConnectedServiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  landingUrl: z.string().url(),
  loginUrl: z.string().url(),
  profile: z.string().min(1),
  status: ConnectedServiceStatusSchema,
});
export type ConnectedService = z.infer<typeof ConnectedServiceSchema>;
