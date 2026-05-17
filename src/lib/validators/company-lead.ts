import { z } from "zod";

export const createLeadSchema = z.object({
  title: z.string().trim().min(2).max(120),
  prospectName: z.string().trim().min(2).max(120),
  estimatedValue: z.coerce.number().int().min(0),
  notes: z.string().trim().max(2000).default(""),
  columnId: z.string().trim().min(1),
});

export const updateLeadSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    prospectName: z.string().trim().min(2).max(120).optional(),
    estimatedValue: z.coerce.number().int().min(0).optional(),
    notes: z.string().trim().max(2000).optional(),
    columnId: z.string().trim().min(1).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required.",
  });
