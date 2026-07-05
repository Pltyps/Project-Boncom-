import { z } from "zod";

// Request-body validation for POST/PUT bodies. Routes call .safeParse() on
// these and return 400 with the zod error tree on failure, so the frontend
// can map errors back to specific fields.
export const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || undefined),
  company: z.string().trim().max(200).optional().transform((v) => v || undefined),
  address: z.string().trim().max(1000).optional().transform((v) => v || undefined),
});

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(500),
  quantity: z.coerce.number().finite().nonnegative(),
  rate: z.coerce.number().finite(),
});

const adjustmentType = z.enum(["flat", "percent"]);

// clientId/title are the only hard requirements; everything else defaults
// to a blank/zeroed estimate so the editor can create one with a single
// field filled in and let the user build it up from there.
export const estimateSchema = z.object({
  clientId: z.string().uuid("A client must be selected"),
  title: z.string().trim().min(1, "Title is required").max(200),
  status: z.enum(["draft", "sent"]).default("draft"),
  discountType: adjustmentType.default("percent"),
  discountValue: z.coerce.number().finite().nonnegative().default(0),
  taxType: adjustmentType.default("percent"),
  taxValue: z.coerce.number().finite().nonnegative().default(0),
  notes: z.string().trim().max(2000).optional().transform((v) => v || undefined),
  dueDate: z.string().trim().optional().or(z.literal("")).transform((v) => v || undefined),
  lineItems: z.array(lineItemSchema).default([]),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type EstimateInput = z.infer<typeof estimateSchema>;
