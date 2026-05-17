import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "./prisma.ts";
import { createQuotationSchema } from "./validators/company-quotation.ts";

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

  const created = await prisma.$transaction(async (tx) => {
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
      const sequence = (await tx.companyQuotation.count({
        where: {
          companyId: context.company.id,
          revisionNumber: 1,
        },
      })) + 1;

      quotationNumber = formatQuotationNumber({
        prefix: context.company.quotationPrefix,
        issuedAt,
        sequence,
      });
    }

    const subtotal = sumQuotationLines(parsed.lines);

    const quotation = await tx.companyQuotation.create({
      data: {
        companyId: context.company.id,
        leadId: lead.id,
        quotationNumber,
        revisionNumber,
        status: parsed.status,
        subtotal,
        total: subtotal,
        issuedAt,
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
  });

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

  const created = await prisma.$transaction(async (tx) => {
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

    const revisions = await tx.companyQuotation.findMany({
      where: {
        companyId: context.company.id,
        leadId: sourceQuotation.leadId,
      },
      select: { revisionNumber: true },
    });

    const subtotal = sumQuotationLines(parsed.lines);

    const quotation = await tx.companyQuotation.create({
      data: {
        companyId: context.company.id,
        leadId: sourceQuotation.leadId,
        quotationNumber: sourceQuotation.quotationNumber,
        revisionNumber: nextRevisionNumber(revisions),
        status: parsed.status,
        subtotal,
        total: subtotal,
        issuedAt: new Date(),
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
  });

  return created;
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
