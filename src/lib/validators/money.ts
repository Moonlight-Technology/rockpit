import { z } from "zod";

export const moneyAccountTypeSchema = z.enum(["CASH", "BANK", "EWALLET", "OTHER"]);
export const moneyCategoryKindSchema = z.enum(["INCOME", "EXPENSE", "BOTH"]);
export const moneyTransactionTypeSchema = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "LEND",
  "RECEIVABLE_PAYMENT",
]);
export const moneyWishlistPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const moneyWishlistStatusSchema = z.enum(["PLANNED", "BOUGHT", "SKIPPED"]);

const amountSchema = z.number().int().positive();
const isoDateSchema = z.string().datetime();

export const createMoneyAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: moneyAccountTypeSchema,
});

export const createMoneyCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: moneyCategoryKindSchema,
});

export const updateMoneyCategorySchema = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).max(80),
  kind: moneyCategoryKindSchema,
});

const baseTransactionSchema = z.object({
  type: moneyTransactionTypeSchema,
  amount: amountSchema,
  description: z.string().trim().max(500).optional().nullable(),
  occurredAt: isoDateSchema,
});

export const createMoneyTransactionSchema = z.discriminatedUnion("type", [
  baseTransactionSchema.extend({
    type: z.literal("INCOME"),
    accountId: z.string().cuid(),
    categoryId: z.string().cuid().optional().nullable(),
  }),
  baseTransactionSchema.extend({
    type: z.literal("EXPENSE"),
    accountId: z.string().cuid(),
    categoryId: z.string().cuid(),
  }),
  baseTransactionSchema.extend({
    type: z.literal("TRANSFER"),
    fromAccountId: z.string().cuid(),
    toAccountId: z.string().cuid(),
  }),
  baseTransactionSchema.extend({
    type: z.literal("LEND"),
    accountId: z.string().cuid(),
    personName: z.string().trim().min(1).max(120),
    dueDate: isoDateSchema.optional().nullable(),
  }),
  baseTransactionSchema.extend({
    type: z.literal("RECEIVABLE_PAYMENT"),
    accountId: z.string().cuid(),
    receivableId: z.string().cuid(),
  }),
]);

export const updateMoneyTransactionSchema = z.discriminatedUnion("type", [
  baseTransactionSchema.extend({
    type: z.literal("INCOME"),
    accountId: z.string().cuid(),
    categoryId: z.string().cuid().optional().nullable(),
  }),
  baseTransactionSchema.extend({
    type: z.literal("EXPENSE"),
    accountId: z.string().cuid(),
    categoryId: z.string().cuid(),
  }),
  baseTransactionSchema.extend({
    type: z.literal("TRANSFER"),
    fromAccountId: z.string().cuid(),
    toAccountId: z.string().cuid(),
  }),
]);

export const upsertMoneyBudgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalAmount: z.number().int().min(0),
  buckets: z
    .array(
      z.object({
        id: z.string().cuid().optional(),
        label: z.string().trim().min(1).max(80),
        percentage: z.number().int().min(0).max(100),
        categoryIds: z.array(z.string().cuid()).default([]),
      })
    )
    .min(1)
    .max(8),
});

export const createWishlistItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  estimatedPrice: z.number().int().min(0),
  priority: moneyWishlistPrioritySchema,
  status: moneyWishlistStatusSchema.default("PLANNED"),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const updateWishlistItemSchema = z.object({
  id: z.string().cuid(),
  status: moneyWishlistStatusSchema,
});

export const createReceivablePaymentSchema = z.object({
  receivableId: z.string().cuid(),
  amount: amountSchema,
  accountId: z.string().cuid(),
  paidAt: isoDateSchema,
  notes: z.string().trim().max(500).optional().nullable(),
});

export type CreateMoneyTransactionInput = z.infer<typeof createMoneyTransactionSchema>;
export type UpdateMoneyTransactionInput = z.infer<typeof updateMoneyTransactionSchema>;
export type UpsertMoneyBudgetInput = z.infer<typeof upsertMoneyBudgetSchema>;
export type CreateReceivablePaymentInput = z.infer<typeof createReceivablePaymentSchema>;
