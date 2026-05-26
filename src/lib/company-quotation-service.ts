import { CompanyLeadStage, Prisma } from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "./prisma.ts";
import { findStageColumn } from "./company-lead-service.ts";
import {
  createQuotationSchema,
  updateQuotationStatusSchema,
} from "./validators/company-quotation.ts";

const QUOTATION_CONFLICT_CODE = "QUOTATION_CONFLICT";
const MAX_QUOTATION_CONFLICT_RETRIES = 3;
const RETRYABLE_QUOTATION_UNIQUES = [
  ["companyId", "quotationNumber", "revisionNumber"],
  ["leadId", "revisionNumber"],
] as const;
const quotationListInclude = {
  lead: {
    select: {
      id: true,
      title: true,
      prospectName: true,
      estimatedValue: true,
      stage: true,
    },
  },
  lines: {
    orderBy: { position: "asc" },
  },
} satisfies Prisma.CompanyQuotationInclude;

type OwnerCompanyContextError = { error: "NOT_FOUND" | "FORBIDDEN" };

type OwnerCompanyContext = {
  company: {
    id: string;
    ownerId: string;
    name: string;
    slug: string;
    description: string;
    quotationPrefix: string;
    leads: Array<{
      id: string;
      title: string;
      prospectName: string;
      estimatedValue: number;
      stage: "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
    }>;
  };
};

type QuotationListRecord = Prisma.CompanyQuotationGetPayload<{
  include: typeof quotationListInclude;
}>;

type QuotationDetailRecord = Prisma.CompanyQuotationGetPayload<{
  include: typeof quotationDetailInclude;
}>;

type QuotationRevisionRecord = {
  id: string;
  quotationNumber: string;
  revisionNumber: number;
  status: "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
  subtotal: number;
  total: number;
  issuedAt: Date | null;
  createdAt: Date;
};

type ListQuotationsResult =
  | OwnerCompanyContextError
  | {
      company: OwnerCompanyContext["company"];
      leads: OwnerCompanyContext["company"]["leads"];
      quotations: QuotationListRecord[];
    };

export type QuotationWarning = { code: "WON_COLUMN_MISSING"; message: string };

type CreateQuotationResult =
  | { data: QuotationDetailRecord; warnings: QuotationWarning[] }
  | {
      error:
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "LEAD_LOST_REQUIRES_REVIVE"
        | "NEGOTIATION_COLUMN_NOT_FOUND";
    };

type CreateQuotationRevisionResult =
  | { data: QuotationDetailRecord; warnings: QuotationWarning[] }
  | {
      error:
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "LEAD_MISMATCH"
        | "LEAD_LOST_REQUIRES_REVIVE"
        | "NEGOTIATION_COLUMN_NOT_FOUND";
    };

type GetQuotationDetailResult =
  | OwnerCompanyContextError
  | {
      company: OwnerCompanyContext["company"];
      quotation: QuotationDetailRecord;
      revisions: QuotationRevisionRecord[];
    }
  | { error: "NOT_FOUND" };

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

type DiscountType = "FIXED" | "PERCENTAGE";

type QuotationLineCalculationInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export function calculateQuotationTotals(input: {
  lines: QuotationLineCalculationInput[];
  discountType: DiscountType;
  discountValue: number;
}) {
  const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const rawDiscount =
    input.discountType === "PERCENTAGE"
      ? Math.floor((subtotal * input.discountValue) / 100)
      : input.discountValue;
  const discountAmount = Math.min(Math.max(rawDiscount, 0), subtotal);
  const total = Math.max(subtotal - discountAmount, 0);

  return { subtotal, discountAmount, total };
}

export function getIssuedAtForQuotationStatus(
  status: "DRAFT" | "SENT" | "APPROVED" | "REJECTED",
  now: Date
) {
  return status === "DRAFT" ? null : now;
}

type QuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

export type StatusTransitionResult = {
  changed: boolean;
  updates: {
    status?: QuotationStatus;
    sentAt?: Date;
    approvedAt?: Date;
    rejectedAt?: Date;
    issuedAt?: Date;
  };
};

export function applyStatusTransition(input: {
  currentStatus: QuotationStatus;
  nextStatus: QuotationStatus;
  timestamps: {
    sentAt: Date | null;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    issuedAt: Date | null;
  };
  now: Date;
}): StatusTransitionResult {
  if (input.currentStatus === input.nextStatus) {
    return { changed: false, updates: {} };
  }

  const updates: StatusTransitionResult["updates"] = {
    status: input.nextStatus,
  };

  if (input.nextStatus === "SENT" && !input.timestamps.sentAt) {
    updates.sentAt = input.now;
  }
  if (input.nextStatus === "APPROVED" && !input.timestamps.approvedAt) {
    updates.approvedAt = input.now;
  }
  if (input.nextStatus === "REJECTED" && !input.timestamps.rejectedAt) {
    updates.rejectedAt = input.now;
  }

  // Maintain legacy issuedAt: set on first non-DRAFT transition only.
  if (input.nextStatus !== "DRAFT" && !input.timestamps.issuedAt) {
    updates.issuedAt = input.now;
  }

  return { changed: true, updates };
}

export async function syncLeadForApprovedQuotation(input: {
  tx: Pick<Prisma.TransactionClient, "companyLead">;
  leadId: string;
  total: number;
  now: Date;
  leadStage: CompanyLeadStage;
  boardColumns: Array<{ id: string; title: string }>;
}) {
  await input.tx.companyLead.update({
    where: { id: input.leadId },
    data: { estimatedValue: input.total },
  });

  if (input.leadStage === CompanyLeadStage.WON) {
    return [] as QuotationWarning[];
  }

  const wonColumn = findStageColumn(input.boardColumns, CompanyLeadStage.WON);
  if (!wonColumn) {
    return [
      {
        code: "WON_COLUMN_MISSING",
        message:
          "Quotation approved, but the 'Won' column was not found in this board. Move the lead manually.",
      },
    ] satisfies QuotationWarning[];
  }

  await input.tx.companyLead.update({
    where: { id: input.leadId },
    data: {
      column: { connect: { id: wonColumn.id } },
      stage: CompanyLeadStage.WON,
      wonAt: input.now,
    },
  });

  return [] as QuotationWarning[];
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

  const errorRecord = error && typeof error === "object" ? (error as Record<string, unknown>) : null;

  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : typeof errorRecord?.code === "string"
        ? errorRecord.code
        : null;

  if (code !== "P2002") {
    return false;
  }

  const rawTarget =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.meta?.target
      : errorRecord?.meta && typeof errorRecord.meta === "object"
        ? "target" in (errorRecord.meta as Record<string, unknown>)
          ? (errorRecord.meta as Record<string, unknown>).target
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

async function getOwnerCompanyContext(
  userId: string,
  companyId: string
): Promise<OwnerCompanyContext | OwnerCompanyContextError> {
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

export async function listQuotationsForUser(
  userId: string,
  companyId: string
): Promise<ListQuotationsResult> {
  const context = await getOwnerCompanyContext(userId, companyId);
  if ("error" in context) {
    return { error: context.error };
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
}): Promise<CreateQuotationResult> {
  const parsed = createQuotationSchema.parse(input.payload);
  const context = await getOwnerCompanyContext(input.userId, input.companyId);
  if ("error" in context) {
    return { error: context.error };
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
          stage: true,
          columnId: true,
          leadBoardId: true,
          leadBoard: {
            select: {
              columns: { select: { id: true, title: true } },
            },
          },
          quotations: {
            orderBy: { revisionNumber: "desc" },
            select: { revisionNumber: true, quotationNumber: true },
          },
        },
      });

      if (!lead) {
        return { error: "NOT_FOUND" as const };
      }

      if (lead.stage === CompanyLeadStage.LOST) {
        if (!parsed.reviveLead) {
          return { error: "LEAD_LOST_REQUIRES_REVIVE" as const };
        }
        const negotiationColumn = findStageColumn(
          lead.leadBoard.columns,
          CompanyLeadStage.NEGOTIATION
        );
        if (!negotiationColumn) {
          return { error: "NEGOTIATION_COLUMN_NOT_FOUND" as const };
        }
        await tx.companyLead.update({
          where: { id: lead.id },
          data: {
            column: { connect: { id: negotiationColumn.id } },
            stage: CompanyLeadStage.NEGOTIATION,
          },
        });
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

      const totals = calculateQuotationTotals({
        lines: parsed.lines,
        discountType: parsed.discountType,
        discountValue: parsed.discountValue,
      });
      const status = parsed.status;
      const issuedQuotationAt = getIssuedAtForQuotationStatus(status, issuedAt);

      const quotation = await tx.companyQuotation.create({
        data: {
          companyId: context.company.id,
          leadId: lead.id,
          quotationNumber,
          revisionNumber,
          status,
          subtotal: totals.subtotal,
          discountType: parsed.discountType,
          discountValue: parsed.discountValue,
          discountAmount: totals.discountAmount,
          total: totals.total,
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

      const warnings =
        status === "APPROVED"
          ? await syncLeadForApprovedQuotation({
              tx,
              leadId: lead.id,
              total: quotation.total,
              now: issuedAt,
              leadStage: lead.stage,
              boardColumns: lead.leadBoard.columns,
            })
          : [];

      return { data: quotation, warnings };
    })
  );

  return created;
}

export async function createQuotationRevisionForUser(input: {
  userId: string;
  companyId: string;
  quotationId: string;
  payload: unknown;
}): Promise<CreateQuotationRevisionResult> {
  const parsed = createQuotationSchema.parse(input.payload);
  const context = await getOwnerCompanyContext(input.userId, input.companyId);
  if ("error" in context) {
    return { error: context.error };
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

      const lead = await tx.companyLead.findFirst({
        where: { id: sourceQuotation.leadId, companyId: context.company.id },
        select: {
          id: true,
          stage: true,
          columnId: true,
          leadBoardId: true,
          leadBoard: {
            select: { columns: { select: { id: true, title: true } } },
          },
        },
      });

      if (!lead) {
        return { error: "NOT_FOUND" as const };
      }

      if (lead.stage === CompanyLeadStage.LOST) {
        if (!parsed.reviveLead) {
          return { error: "LEAD_LOST_REQUIRES_REVIVE" as const };
        }
        const negotiationColumn = findStageColumn(
          lead.leadBoard.columns,
          CompanyLeadStage.NEGOTIATION
        );
        if (!negotiationColumn) {
          return { error: "NEGOTIATION_COLUMN_NOT_FOUND" as const };
        }
        await tx.companyLead.update({
          where: { id: lead.id },
          data: {
            column: { connect: { id: negotiationColumn.id } },
            stage: CompanyLeadStage.NEGOTIATION,
          },
        });
      }

      const latestRevision = await tx.companyQuotation.findFirst({
        where: {
          companyId: context.company.id,
          leadId: sourceQuotation.leadId,
        },
        orderBy: { revisionNumber: "desc" },
        select: { revisionNumber: true },
      });

      const totals = calculateQuotationTotals({
        lines: parsed.lines,
        discountType: parsed.discountType,
        discountValue: parsed.discountValue,
      });
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
          subtotal: totals.subtotal,
          discountType: parsed.discountType,
          discountValue: parsed.discountValue,
          discountAmount: totals.discountAmount,
          total: totals.total,
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

      const warnings: QuotationWarning[] = [];

      if (status === "APPROVED" && lead.stage !== CompanyLeadStage.WON) {
        const wonColumn = findStageColumn(
          lead.leadBoard.columns,
          CompanyLeadStage.WON
        );
        if (wonColumn) {
          await tx.companyLead.update({
            where: { id: lead.id },
            data: {
              column: { connect: { id: wonColumn.id } },
              stage: CompanyLeadStage.WON,
              wonAt: issuedAt,
            },
          });
        } else {
          warnings.push({
            code: "WON_COLUMN_MISSING",
            message:
              "Quotation approved, but the 'Won' column was not found in this board. Move the lead manually.",
          });
        }
      }

      return { data: quotation, warnings };
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

export type UpdateQuotationStatusResult =
  | {
      data: QuotationDetailRecord;
      warnings: QuotationWarning[];
    }
  | { error: "FORBIDDEN" | "NOT_FOUND" | "NOT_LATEST_REVISION" };

export async function updateQuotationStatusForUser(input: {
  userId: string;
  companyId: string;
  quotationId: string;
  payload: unknown;
}): Promise<UpdateQuotationStatusResult> {
  const parsed = updateQuotationStatusSchema.parse(input.payload);
  const context = await getOwnerCompanyContext(input.userId, input.companyId);
  if ("error" in context) {
    return { error: context.error };
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.companyQuotation.findFirst({
      where: { id: input.quotationId, companyId: context.company.id },
      select: {
        id: true,
        leadId: true,
        quotationNumber: true,
        revisionNumber: true,
        status: true,
        sentAt: true,
        approvedAt: true,
        rejectedAt: true,
        issuedAt: true,
      },
    });
    if (!existing) {
      return { error: "NOT_FOUND" as const };
    }

    const latest = await tx.companyQuotation.findFirst({
      where: {
        companyId: context.company.id,
        leadId: existing.leadId,
        quotationNumber: existing.quotationNumber,
      },
      orderBy: { revisionNumber: "desc" },
      select: { id: true },
    });
    if (latest?.id !== existing.id) {
      return { error: "NOT_LATEST_REVISION" as const };
    }

    const transition = applyStatusTransition({
      currentStatus: existing.status,
      nextStatus: parsed.status,
      timestamps: {
        sentAt: existing.sentAt,
        approvedAt: existing.approvedAt,
        rejectedAt: existing.rejectedAt,
        issuedAt: existing.issuedAt,
      },
      now,
    });

    const warnings: QuotationWarning[] = [];

    if (!transition.changed) {
      const current = await tx.companyQuotation.findFirst({
        where: { id: existing.id },
        include: quotationDetailInclude,
      });
      return { data: current!, warnings };
    }

    const updated = await tx.companyQuotation.update({
      where: { id: existing.id },
      data: transition.updates,
      include: quotationDetailInclude,
    });

    if (parsed.status === "APPROVED") {
      const lead = await tx.companyLead.findFirst({
        where: { id: existing.leadId, companyId: context.company.id },
        select: {
          id: true,
          stage: true,
          leadBoardId: true,
          leadBoard: {
            select: {
              columns: { select: { id: true, title: true } },
            },
          },
        },
      });

      if (lead && lead.stage !== CompanyLeadStage.WON) {
        const wonColumn = findStageColumn(lead.leadBoard.columns, CompanyLeadStage.WON);
        if (wonColumn) {
          await tx.companyLead.update({
            where: { id: lead.id },
            data: {
              column: { connect: { id: wonColumn.id } },
              stage: CompanyLeadStage.WON,
              wonAt: now,
            },
          });
        } else {
          warnings.push({
            code: "WON_COLUMN_MISSING",
            message:
              "Quotation approved, but the 'Won' column was not found in this board. Move the lead manually.",
          });
        }
      }
    }

    return { data: updated, warnings };
  });
}

export async function getQuotationDetailForUser(input: {
  userId: string;
  companyId: string;
  quotationId: string;
}): Promise<GetQuotationDetailResult> {
  const context = await getOwnerCompanyContext(input.userId, input.companyId);
  if ("error" in context) {
    return { error: context.error };
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
