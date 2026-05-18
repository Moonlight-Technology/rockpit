import { z } from "zod";
import { normalizeQuotationPrefix } from "../company-premium.ts";

export const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(""),
  businessType: z.literal("JASA").default("JASA"),
  quotationPrefix: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .transform((value) => normalizeQuotationPrefix(value))
    .refine((value) => value.length >= 2, "Quotation prefix is required."),
});
