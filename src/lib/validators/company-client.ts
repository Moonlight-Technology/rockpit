import { z } from "zod";

const optionalClientText = z.string().trim().max(500).default("");

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  companyName: z.string().trim().max(160).default(""),
  address: z.string().trim().max(500).default(""),
  notes: optionalClientText,
});

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(160).or(z.literal("")).optional(),
    phone: z.string().trim().max(40).optional(),
    companyName: z.string().trim().max(160).optional(),
    address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required.",
  });
