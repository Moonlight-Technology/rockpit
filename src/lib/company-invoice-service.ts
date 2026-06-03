import type {
  CompanyInvoice,
  CompanyInvoiceLine,
  CompanyInvoiceStatus,
  CompanyLead,
  CompanyQuotation,
  Prisma,
  User,
} from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "./prisma.ts";
import {
  createInvoiceSchema,
  updateInvoiceStatusSchema,
  type InvoiceLineInput,
} from "./validators/company-invoice.ts";

type InvoiceStatus = CompanyInvoiceStatus;

type CompanySummary = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  quotationPrefix: string;
};

type InvoiceListItem = CompanyInvoice & {
  quotation: Pick<CompanyQuotation, "id" | "quotationNumber" | "revisionNumber" | "status" | "total">;
  lead: Pick<CompanyLead, "id" | "title" | "prospectName" | "estimatedValue">;
};

type InvoiceDetailRecord = CompanyInvoice & {
  quotation: Pick<CompanyQuotation, "id" | "quotationNumber" | "revisionNumber" | "status" | "total">;
  lead: Pick<CompanyLead, "id" | "title" | "prospectName" | "estimatedValue">;
  createdBy: Pick<User, "id" | "name" | "email">;
  lines: CompanyInvoiceLine[];
};

type InvoiceServiceError =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "QUOTATION_NOT_APPROVED"
  | "INVOICE_TOTAL_EXCEEDS_QUOTATION"
  | "INVALID_STATUS_TRANSITION";

type InvoiceServiceDeps = {
  prisma: {
    company: {
      findFirst: (args: unknown) => Promise<CompanySummary | null>;
    };
    companyQuotation: {
      findFirst: (args: unknown) => Promise<
        | (Pick<CompanyQuotation, "id" | "companyId" | "leadId" | "quotationNumber" | "revisionNumber" | "total" | "status"> & {
            lead?: Pick<CompanyLead, "id" | "title" | "prospectName" | "estimatedValue">;
          })
        | null
      >;
      findMany: (args: unknown) => Promise<Array<Pick<CompanyQuotation, "quotationNumber">>>;
    };
    companyInvoice: {
      findMany: (
        args: unknown
      ) => Promise<Array<InvoiceListItem | Pick<CompanyInvoice, "invoiceNumber">>>;
      findFirst: (args: unknown) => Promise<InvoiceDetailRecord | null>;
      aggregate: (args: unknown) => Promise<{ _sum: { total: number | null } }>;
      create: (args: unknown) => Promise<InvoiceDetailRecord>;
      update: (args: unknown) => Promise<InvoiceDetailRecord>;
    };
    $transaction: <T>(input: (tx: InvoiceServiceDeps["prisma"]) => Promise<T>) => Promise<T>;
  };
};

const defaultDeps: InvoiceServiceDeps = {
  prisma: prisma as unknown as InvoiceServiceDeps["prisma"],
};

const ACTIVE_INVOICE_STATUSES: CompanyInvoiceStatus[] = ["DRAFT", "SENT", "PAID"];

const ownerCompanySelect = {
  id: true,
  ownerId: true,
  name: true,
  slug: true,
  description: true,
  quotationPrefix: true,
} satisfies Prisma.CompanySelect;

const invoiceListInclude = {
  quotation: {
    select: {
      id: true,
      quotationNumber: true,
      revisionNumber: true,
      status: true,
      total: true,
    },
  },
  lead: {
    select: {
      id: true,
      title: true,
      prospectName: true,
      estimatedValue: true,
    },
  },
} satisfies Prisma.CompanyInvoiceInclude;

const invoiceDetailInclude = {
  quotation: {
    select: {
      id: true,
      quotationNumber: true,
      revisionNumber: true,
      total: true,
      status: true,
    },
  },
  lead: {
    select: {
      id: true,
      title: true,
      prospectName: true,
      estimatedValue: true,
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
} satisfies Prisma.CompanyInvoiceInclude;

async function getOwnerCompany(
  userId: string,
  companyId: string,
  deps: InvoiceServiceDeps
): Promise<CompanySummary | { error: InvoiceServiceError }> {
  const company = await deps.prisma.company.findFirst({
    where: { id: companyId },
    select: ownerCompanySelect,
  });

  if (!company) {
    return { error: "NOT_FOUND" };
  }

  if (company.ownerId !== userId) {
    return { error: "FORBIDDEN" };
  }

  return company;
}

function createInvoiceLines(lines: InvoiceLineInput[]) {
  return lines.map((line, index) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    position: index,
  }));
}

export async function listInvoicesForUser(userId: string, companyId: string) {
  return listInvoicesForUserWithDependencies(userId, companyId, defaultDeps);
}

export async function listInvoicesForUserWithDependencies(
  userId: string,
  companyId: string,
  deps: InvoiceServiceDeps
): Promise<
  | { error: InvoiceServiceError }
  | {
      company: CompanySummary;
      invoices: InvoiceListItem[];
    }
> {
  const company = await getOwnerCompany(userId, companyId, deps);
  if ("error" in company) {
    return company;
  }

  const invoices = await deps.prisma.companyInvoice.findMany({
    where: { companyId },
    include: invoiceListInclude,
    orderBy: [{ createdAt: "desc" }],
  });

  return { company, invoices: invoices as InvoiceListItem[] };
}

export async function createInvoiceForUser(input: {
  userId: string;
  companyId: string;
  payload: unknown;
}) {
  return createInvoiceForUserWithDependencies(input, defaultDeps);
}

export async function createInvoiceForUserWithDependencies(
  input: {
    userId: string;
    companyId: string;
    payload: unknown;
  },
  deps: InvoiceServiceDeps
): Promise<{ error: InvoiceServiceError } | { data: InvoiceDetailRecord }> {
  const payload = createInvoiceSchema.parse(input.payload);
  const company = await getOwnerCompany(input.userId, input.companyId, deps);
  if ("error" in company) {
    return company;
  }

  const quotation = await deps.prisma.companyQuotation.findFirst({
    where: {
      id: payload.quotationId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      companyId: true,
      leadId: true,
      quotationNumber: true,
      revisionNumber: true,
      total: true,
      status: true,
    },
  });

  if (!quotation) {
    return { error: "NOT_FOUND" };
  }

  if (quotation.status !== "APPROVED") {
    return { error: "QUOTATION_NOT_APPROVED" };
  }

  const { subtotal, total } = calculateInvoiceTotals({ lines: payload.lines });
  const activeTotals = await deps.prisma.companyInvoice.aggregate({
    where: {
      quotationId: quotation.id,
      status: { in: ACTIVE_INVOICE_STATUSES },
    },
    _sum: { total: true },
  });

  const usedTotal = activeTotals._sum.total ?? 0;
  if (usedTotal + total > quotation.total) {
    return { error: "INVOICE_TOTAL_EXCEEDS_QUOTATION" };
  }

  const now = new Date();
  const monthPattern = `${company.quotationPrefix}/INV/${invoiceMonthKey(now)}/`;
  const monthlySeries = await deps.prisma.companyInvoice.findMany({
    where: {
      companyId: input.companyId,
      invoiceNumber: {
        startsWith: monthPattern,
      },
    },
    select: { invoiceNumber: true },
  });

  const invoiceNumber = formatInvoiceNumber({
    prefix: company.quotationPrefix,
    issuedAt: now,
    sequence: nextInvoiceSequence({
      prefix: company.quotationPrefix,
      issuedAt: now,
      existingInvoiceNumbers: monthlySeries.map((item) => item.invoiceNumber),
    }),
  });

  const created = await deps.prisma.$transaction(async (tx) =>
    tx.companyInvoice.create({
      data: {
        companyId: input.companyId,
        quotationId: quotation.id,
        leadId: quotation.leadId,
        createdByUserId: input.userId,
        invoiceNumber,
        status: "DRAFT",
        subtotal,
        total,
        notes: payload.notes,
        lines: {
          create: createInvoiceLines(payload.lines),
        },
      },
      include: invoiceDetailInclude,
    })
  );

  return { data: created };
}

export async function getInvoiceDetailForUser(input: {
  userId: string;
  companyId: string;
  invoiceId: string;
}) {
  return getInvoiceDetailForUserWithDependencies(input, defaultDeps);
}

export async function getInvoiceDetailForUserWithDependencies(
  input: {
    userId: string;
    companyId: string;
    invoiceId: string;
  },
  deps: InvoiceServiceDeps
): Promise<
  | { error: InvoiceServiceError }
  | {
      company: CompanySummary;
      invoice: InvoiceDetailRecord;
    }
> {
  const company = await getOwnerCompany(input.userId, input.companyId, deps);
  if ("error" in company) {
    return company;
  }

  const invoice = await deps.prisma.companyInvoice.findFirst({
    where: {
      id: input.invoiceId,
      companyId: input.companyId,
    },
    include: invoiceDetailInclude,
  });

  if (!invoice) {
    return { error: "NOT_FOUND" };
  }

  return { company, invoice };
}

export async function updateInvoiceStatusForUser(input: {
  userId: string;
  companyId: string;
  invoiceId: string;
  payload: unknown;
}) {
  return updateInvoiceStatusForUserWithDependencies(input, defaultDeps);
}

export async function updateInvoiceStatusForUserWithDependencies(
  input: {
    userId: string;
    companyId: string;
    invoiceId: string;
    payload: unknown;
  },
  deps: InvoiceServiceDeps
): Promise<{ error: InvoiceServiceError } | { data: InvoiceDetailRecord }> {
  const payload = updateInvoiceStatusSchema.parse(input.payload);
  const company = await getOwnerCompany(input.userId, input.companyId, deps);
  if ("error" in company) {
    return company;
  }

  const invoice = await deps.prisma.companyInvoice.findFirst({
    where: {
      id: input.invoiceId,
      companyId: input.companyId,
    },
    include: invoiceDetailInclude,
  });

  if (!invoice) {
    return { error: "NOT_FOUND" };
  }

  let transition: ReturnType<typeof applyInvoiceStatusTransition>;
  try {
    transition = applyInvoiceStatusTransition({
      currentStatus: invoice.status,
      nextStatus: payload.status,
      timestamps: {
        issuedAt: invoice.issuedAt,
        paidAt: invoice.paidAt,
        cancelledAt: invoice.cancelledAt,
      },
      now: new Date(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_STATUS_TRANSITION") {
      return { error: "INVALID_STATUS_TRANSITION" };
    }

    throw error;
  }

  if (!transition.changed) {
    return { data: invoice };
  }

  const updated = await deps.prisma.companyInvoice.update({
    where: { id: invoice.id },
    data: transition.updates,
    include: invoiceDetailInclude,
  });

  return { data: updated };
}

export function formatInvoiceNumber(input: {
  prefix: string;
  issuedAt: Date;
  sequence: number;
}) {
  return `${input.prefix}/INV/${format(input.issuedAt, "yyyy/MM")}/${String(input.sequence).padStart(3, "0")}`;
}

function invoiceMonthKey(date: Date) {
  return format(date, "yyyy/MM");
}

export function nextInvoiceSequence(input: {
  prefix: string;
  issuedAt: Date;
  existingInvoiceNumbers: string[];
}) {
  const monthKey = invoiceMonthKey(input.issuedAt);
  let maxSequence = 0;

  for (const invoiceNumber of input.existingInvoiceNumbers) {
    const match = invoiceNumber.match(/^(.+)\/INV\/(\d{4}\/\d{2})\/(\d+)$/);
    if (!match) {
      continue;
    }

    const [, prefix, currentMonthKey, sequence] = match;
    if (prefix !== input.prefix || currentMonthKey !== monthKey) {
      continue;
    }

    maxSequence = Math.max(maxSequence, Number(sequence));
  }

  return maxSequence + 1;
}

export function calculateInvoiceTotals(input: {
  lines: Array<{ description: string; quantity: number; unitPrice: number }>;
}) {
  const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  return { subtotal, total: subtotal };
}

export function applyInvoiceStatusTransition(input: {
  currentStatus: InvoiceStatus;
  nextStatus: InvoiceStatus;
  timestamps: {
    issuedAt: Date | null;
    paidAt: Date | null;
    cancelledAt: Date | null;
  };
  now: Date;
}) {
  const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    DRAFT: ["SENT", "CANCELLED"],
    SENT: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  };

  if (input.currentStatus === input.nextStatus) {
    return { changed: false, updates: {} };
  }

  if (!allowedTransitions[input.currentStatus].includes(input.nextStatus)) {
    throw new Error("INVALID_STATUS_TRANSITION");
  }

  const updates: {
    status: InvoiceStatus;
    issuedAt?: Date;
    paidAt?: Date;
    cancelledAt?: Date;
  } = {
    status: input.nextStatus,
  };

  if (input.nextStatus === "SENT" && !input.timestamps.issuedAt) {
    updates.issuedAt = input.now;
  }

  if (input.nextStatus === "PAID" && !input.timestamps.paidAt) {
    updates.paidAt = input.now;
  }

  if (input.nextStatus === "CANCELLED" && !input.timestamps.cancelledAt) {
    updates.cancelledAt = input.now;
  }

  return { changed: true, updates };
}
