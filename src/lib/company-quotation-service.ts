import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "./prisma.ts";
import { createQuotationSchema } from "./validators/company-quotation.ts";

const QUOTATION_CONFLICT_CODE = "QUOTATION_CONFLICT";
const MAX_QUOTATION_CONFLICT_RETRIES = 3;
const RETRYABLE_QUOTATION_UNIQUES = [
  ["companyId", "quotationNumber", "revisionNumber"],
  ["leadId", "revisionNumber"],
] as const;
const QUOTATION_STATUS_WITH_ISSUED_AT = new Set(["SENT", "APPROVED", "REJECTED"] as const);

const quotationListInclude = {
  lead: {
    select: {
      id: true,
      title: true,
      prospectName: true,
      estimatedValue: true,
    },
  },
  lines: {
    orderBy: { position: "asc" },
  },
} satisfies Prisma.CompanyQuotationInclude;

const quotationDetailInclude = {
  company: {
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      quotationPrefix: true,
    },
  },
  lead: {
    select: {
      id: true,
      title: true,
      prospectName: true,
      estimatedValue: true,
      notes: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  lines: {
    orderBy: { position: "asc" },
  },
} satisfies Prisma.CompanyQuotationInclude;

export function formatQuotationNumber(input: {
  prefix: string;
  issuedAt: Date;
  sequence: number;
}) {
  return `${input.prefix}/QT/${format(input.issuedAt, "yyyy/MM")}/${String(input.sequence).padStart(3, "0")}`;
}

export function nextRevisionNumber(items: Array<{ revisionNumber: number }>) {
  return items.length === 0 ? 1 : Math.max(...items.map((item) => item.revisionNumber)) + 1;
}

function quotationMonthKey(date: Date) {
  return format(date, "yyyy/MM");
}

function parseQuotationSequence(input: { prefix: string; quotationNumber: string; monthKey: string }) {
  const match = input.quotationNumber.match(/^(.+)\/QT\/(\d{4}\/\d{2})\/(\d+)$/);
  if (!match) {
    return null;
  }

  const [, prefix, monthKey, sequence] = match;
  if (prefix !== input.prefix || monthKey !== input.monthKey) {
    return null;
  }

  const value = Number(sequence);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function nextQuotationSequence(input: {
  prefix: string;
  issuedAt: Date;
  existingQuotationNumbers: string[];
}) {
  const monthKey = quotationMonthKey(input.issuedAt);
  let maxSequence = 0;

  for (const quotationNumber of input.existingQuotationNumbers) {
    const sequence = parseQuotationSequence({
      prefix: input.prefix,
      quotationNumber,
      monthKey,
    });

    if (sequence && sequence > maxSequence) {
      maxSequence = sequence;
    }
  }

  return maxSequence + 1;
}

export function getIssuedAtForQuotationStatus(
  status: "DRAFT" | "SENT" | "APPROVED" | "REJECTED",
  now: Date
) {
  return QUOTATION_STATUS_WITH_ISSUED_AT.has(status) ? now : null;
}

function normalizeErrorTarget(target: unknown) {
  if (Array.isArray(target)) {
    return target.map((item) => String(item));
  }
  if (typeof target === "string") {
    return [target];
  }
  return [];
}

function sameTarget(left: string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function isRetryableQuotationConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) && typeof error !== "object") {
    return false;
  }

  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : "code" in (error ?? {}) && typeof error.code === "string"
        ? error.code
        : null;

  if (code !== "P2002") {
    return false;
  }

  const rawTarget =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.meta?.target
      : "meta" in (error ?? {}) && typeof error.meta === "object" && error.meta !== null
        ? "target" in error.meta
          ? error.meta.target
          : undefined
        : undefined;

  const target = normalizeErrorTarget(rawTarget);
  return RETRYABLE_QUOTATION_UNIQUES.some((candidate) => sameTarget(target, candidate));
}

export async function retryOnQuotationConflict<T>(
  operation: () => Promise<T>,
  maxAttempts = MAX_QUOTATION_CONFLICT_RETRIES
) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;

      if (!isRetryableQuotationConflict(error)) {
        throw error;
      }

      if (attempt >= maxAttempts) {
        throw createQuotationConflictError();
      }
    }
  }

  throw createQuotationConflictError();
}

function createQuotationConflictError() {
  const error = new Error("Quotation numbering conflict. Please retry.") as Error & {
    code: typeof QUOTATION_CONFLICT_CODE;
  };
  error.code = QUOTATION_CONFLICT_CODE;
  return error;
}

async function getOwnerCompanyContext(userId: string, companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      slug: true,
      description: true,
      quotationPrefix: true,
      leads: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          prospectName: true,
          estimatedValue: true,
          stage: true,
        },
      },
    },
  });

  if (!company) {
    return { error: "NOT_FOUND" as const };
  }

  if (company.ownerId !== userId) {
    return { error: "FORBIDDEN" as const };
  }

  return { company };
}

function sumQuotationLines(lines: Array<{ quantity: number; unitPrice: number }>) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

export async function listQuotationsForUser(userId: string, companyId: string) {
  const context = await getOwnerCompanyContext(userId, companyId);
  if ("error" in context) {
    return context;
  }

  const quotations = await prisma.companyQuotation.findMany({
    where: { companyId },
    include: quotationListInclude,
    orderBy: [{ createdAt: "desc" }, { revisionNumber: "desc" }],
  });

  return {
    company: context.company,
    leads: context.company.leads,
    quotations,
  };
}

export async function createQuotationForUser(input: {
  userId: string;
  companyId: string;
  payload: unknown;
}) {
  const parsed = createQuotationSchema.parse(input.payload);
  const context = await getOwnerCompanyContext(input.userId, input.companyId);
  if ("error" in context) {
    return context;
  }

  const created = await retryOnQuotationConflict(() =>
    prisma.$transaction(async (tx) => {
      const lead = await tx.companyLead.findFirst({
        where: {
          id: parsed.leadId,
          companyId: context.company.id,
        },
        select: {
          id: true,
          quotations: {
            orderBy: { revisionNumber: "desc" },
            select: { revisionNumber: true, quotationNumber: true },
          },
        },
      });

      if (!lead) {
        return { error: "NOT_FOUND" as const };
      }

      const issuedAt = new Date();
      const existingRevisions = lead.quotations;
      const revisionNumber = nextRevisionNumber(existingRevisions);
      let quotationNumber = existingRevisions[0]?.quotationNumber;

      if (!quotationNumber) {
        const monthPattern = `${context.company.quotationPrefix}/QT/${quotationMonthKey(issuedAt)}/`;
        const monthlySeries = await tx.companyQuotation.findMany({
          where: {
            companyId: context.company.id,
            revisionNumber: 1,
            quotationNumber: {
              startsWith: monthPattern,
            },
          },
          select: { quotationNumber: true },
        });

        quotationNumber = formatQuotationNumber({
          prefix: context.company.quotationPrefix,
          issuedAt,
          sequence: nextQuotationSequence({
            prefix: context.company.quotationPrefix,
            issuedAt,
            existingQuotationNumbers: monthlySeries.map((item) => item.quotationNumber),
          }),
        });
      }

      const subtotal = sumQuotationLines(parsed.lines);
      const status = parsed.status;
      const issuedQuotationAt = getIssuedAtForQuotationStatus(status, issuedAt);

      const quotation = await tx.companyQuotation.create({
        data: {
          companyId: context.company.id,
          leadId: lead.id,
          quotationNumber,
          revisionNumber,
          status,
          subtotal,
          total: subtotal,
          issuedAt: issuedQuotationAt,
          createdByUserId: input.userId,
          lines: {
            create: parsed.lines.map((line, index) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.quantity * line.unitPrice,
              position: index,
            })),
          },
        },
        include: quotationDetailInclude,
      });

      return { data: quotation };
    })
  );

  return created;
}

export async function createQuotationRevisionForUser(input: {
  userId: string;
  companyId: string;
  quotationId: string;
  payload: unknown;
}) {
  const parsed = createQuotationSchema.parse(input.payload);
  const context = await getOwnerCompanyContext(input.userId, input.companyId);
  if ("error" in context) {
    return context;
  }

  const created = await retryOnQuotationConflict(() =>
    prisma.$transaction(async (tx) => {
      const sourceQuotation = await tx.companyQuotation.findFirst({
        where: {
          id: input.quotationId,
          companyId: context.company.id,
        },
        select: {
          id: true,
          leadId: true,
          quotationNumber: true,
        },
      });

      if (!sourceQuotation) {
        return { error: "NOT_FOUND" as const };
      }

      if (sourceQuotation.leadId !== parsed.leadId) {
        return { error: "LEAD_MISMATCH" as const };
      }

      const latestRevision = await tx.companyQuotation.findFirst({
        where: {
          companyId: context.company.id,
          leadId: sourceQuotation.leadId,
        },
        orderBy: { revisionNumber: "desc" },
        select: { revisionNumber: true },
      });

      const subtotal = sumQuotationLines(parsed.lines);
      const issuedAt = new Date();
      const status = parsed.status;
      const issuedQuotationAt = getIssuedAtForQuotationStatus(status, issuedAt);

      const quotation = await tx.companyQuotation.create({
        data: {
          companyId: context.company.id,
          leadId: sourceQuotation.leadId,
          quotationNumber: sourceQuotation.quotationNumber,
          revisionNumber: nextRevisionNumber(latestRevision ? [latestRevision] : []),
          status,
          subtotal,
          total: subtotal,
          issuedAt: issuedQuotationAt,
          createdByUserId: input.userId,
          lines: {
            create: parsed.lines.map((line, index) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.quantity * line.unitPrice,
              position: index,
            })),
          },
        },
        include: quotationDetailInclude,
      });

      return { data: quotation };
    })
  );

  return created;
}

export function isQuotationConflictError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === QUOTATION_CONFLICT_CODE
  );
}

export async function getQuotationDetailForUser(input: {
  userId: string;
  companyId: string;
  quotationId: string;
}) {
  const context = await getOwnerCompanyContext(input.userId, input.companyId);
  if ("error" in context) {
    return context;
  }

  const quotation = await prisma.companyQuotation.findFirst({
    where: {
      id: input.quotationId,
      companyId: context.company.id,
    },
    include: quotationDetailInclude,
  });

  if (!quotation) {
    return { error: "NOT_FOUND" as const };
  }

  const revisions = await prisma.companyQuotation.findMany({
    where: {
      companyId: context.company.id,
      leadId: quotation.lead.id,
    },
    orderBy: { revisionNumber: "desc" },
    select: {
      id: true,
      quotationNumber: true,
      revisionNumber: true,
      status: true,
      subtotal: true,
      total: true,
      issuedAt: true,
      createdAt: true,
    },
  });

  return {
    company: context.company,
    quotation,
    revisions,
  };
}
