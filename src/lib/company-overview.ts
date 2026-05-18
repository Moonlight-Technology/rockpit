import { isSameMonth } from "date-fns";

export function groupLeadsByColumn<
  TLead extends { id: string; columnId: string; estimatedValue: number },
>(
  columns: Array<{ id: string; title: string; position: number }>,
  leads: TLead[]
) {
  return [...columns]
    .sort((a, b) => a.position - b.position)
    .map((column) => {
      const columnLeads = leads.filter((lead) => lead.columnId === column.id);
      return {
        ...column,
        leads: columnLeads,
        totalEstimatedValue: columnLeads.reduce(
          (sum, lead) => sum + lead.estimatedValue,
          0
        ),
      };
    });
}

export function buildCompanyOverviewMetrics(input: {
  leads: Array<{ stage: string; estimatedValue: number; wonAt: Date | null }>;
  quotations: Array<{
    leadId: string;
    status: string;
    total: number;
    revisionNumber: number;
    createdAt: Date;
  }>;
  activeProjectCount: number;
  now: Date;
}) {
  const openPipelineValue = input.leads
    .filter((lead) => lead.stage !== "WON" && lead.stage !== "LOST")
    .reduce((sum, lead) => sum + lead.estimatedValue, 0);

  const latestDraftTotalsByLead = new Map<
    string,
    { status: string; total: number; revisionNumber: number; createdAt: Date }
  >();

  for (const quotation of input.quotations) {
    const current = latestDraftTotalsByLead.get(quotation.leadId);

    if (
      !current ||
      quotation.revisionNumber > current.revisionNumber ||
      (quotation.revisionNumber === current.revisionNumber &&
        quotation.createdAt.getTime() > current.createdAt.getTime())
    ) {
      latestDraftTotalsByLead.set(quotation.leadId, {
        status: quotation.status,
        total: quotation.total,
        revisionNumber: quotation.revisionNumber,
        createdAt: quotation.createdAt,
      });
    }
  }

  const quotationDraftValue = [...latestDraftTotalsByLead.values()]
    .filter((quotation) => quotation.status === "DRAFT")
    .reduce((sum, quotation) => sum + quotation.total, 0);

  const wonValueThisMonth = input.leads
    .filter((lead) => lead.stage === "WON" && lead.wonAt && isSameMonth(lead.wonAt, input.now))
    .reduce((sum, lead) => sum + lead.estimatedValue, 0);

  return {
    openPipelineValue,
    quotationDraftValue,
    wonValueThisMonth,
    activeProjectCount: input.activeProjectCount,
  };
}

export async function getCompanyOverviewForUser(userId: string, companyId: string) {
  const [{ WorkspaceType }, { prisma }] = await Promise.all([
    import("@prisma/client"),
    import("./prisma"),
  ]);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      quotationPrefix: true,
      ownerId: true,
      leads: {
        select: {
          stage: true,
          estimatedValue: true,
          wonAt: true,
        },
      },
      quotations: {
        select: {
          leadId: true,
          status: true,
          total: true,
          revisionNumber: true,
          createdAt: true,
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

  const activeProjectCount = await prisma.board.count({
    where: {
      ownerId: userId,
      companyId: company.id,
      workspaceType: WorkspaceType.COMPANY,
      closedAt: null,
    },
  });

  const metrics = buildCompanyOverviewMetrics({
    leads: company.leads,
    quotations: company.quotations,
    activeProjectCount,
    now: new Date(),
  });

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      description: company.description,
      quotationPrefix: company.quotationPrefix,
    },
    metrics,
  };
}
