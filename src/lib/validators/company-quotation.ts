import { z } from "zod";

export const quotationStatusSchema = z.enum(["DRAFT", "SENT", "APPROVED", "REJECTED"]);

export const quotationLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().int().min(0),
});

export const createQuotationSchema = z.object({
  leadId: z.string().trim().min(1),
  lines: z.array(quotationLineSchema).min(1),
  status: quotationStatusSchema.default("DRAFT"),
  reviveLead: z.boolean().default(false),
});

export const updateQuotationStatusSchema = z
  .object({
    status: quotationStatusSchema,
  })
  .strict();

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type QuotationLineInput = z.infer<typeof quotationLineSchema>;
export type UpdateQuotationStatusInput = z.infer<typeof updateQuotationStatusSchema>;
