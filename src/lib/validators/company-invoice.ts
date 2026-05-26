import { z } from "zod";

export const invoiceStatusSchema = z.enum(["DRAFT", "SENT", "PAID", "CANCELLED"]);

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().int().min(0),
});

export const createInvoiceSchema = z.object({
  quotationId: z.string().trim().min(1),
  lines: z.array(invoiceLineSchema).min(1),
  notes: z.string().trim().max(2_000).default(""),
});

export const updateInvoiceStatusSchema = z
  .object({
    status: invoiceStatusSchema,
  })
  .strict();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
