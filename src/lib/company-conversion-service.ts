import { Prisma, WorkspaceType } from "@prisma/client";

export function canConvertLeadToProject(input: {
  stage: string;
  convertedProjectBoardId: string | null;
}) {
  return input.stage === "WON" && !input.convertedProjectBoardId;
}

type ConvertLeadToProjectError = "FORBIDDEN" | "NOT_FOUND" | "INVALID_STAGE" | "ALREADY_CONVERTED";

type ConvertLeadToProjectResult =
  | {
      data: {
        boardId: string;
        companyId: string;
        leadId: string;
        workspaceType: WorkspaceType.COMPANY;
      };
    }
  | { error: ConvertLeadToProjectError };

function buildProjectBoardDescription(input: {
  leadTitle: string;
  prospectName: string;
  notes: string;
}) {
  const normalizedNotes = input.notes.trim();
  if (normalizedNotes) {
    return normalizedNotes;
  }

  return `Converted from won lead "${input.leadTitle}" for ${input.prospectName}.`;
}

class ConvertLeadToProjectTransactionError extends Error {
  readonly reason: ConvertLeadToProjectError;

  constructor(reason: ConvertLeadToProjectError) {
    super(reason);
    this.name = "ConvertLeadToProjectTransactionError";
    this.reason = reason;
  }
}

export async function convertLeadToProjectForUser(input: {
  userId: string;
  companyId: string;
  leadId: string;
}): Promise<ConvertLeadToProjectResult> {
  const [{ createCompanyProjectBoard }, { prisma }] = await Promise.all([
    import("./board-service"),
    import("./prisma"),
  ]);

  try {
    return await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: input.companyId },
        select: { id: true, ownerId: true },
      });

      if (!company) {
        return { error: "NOT_FOUND" as const };
      }

      if (company.ownerId !== input.userId) {
        return { error: "FORBIDDEN" as const };
      }

      const lead = await tx.companyLead.findFirst({
        where: {
          id: input.leadId,
          companyId: company.id,
        },
        select: {
          id: true,
          title: true,
          prospectName: true,
          notes: true,
          stage: true,
          convertedProjectBoardId: true,
        },
      });

      if (!lead) {
        return { error: "NOT_FOUND" as const };
      }

      if (!canConvertLeadToProject(lead)) {
        return {
          error: lead.convertedProjectBoardId ? ("ALREADY_CONVERTED" as const) : ("INVALID_STAGE" as const),
        };
      }

      const board = await createCompanyProjectBoard({
        tx,
        userId: input.userId,
        companyId: company.id,
        sourceLeadId: lead.id,
        title: lead.title,
        description: buildProjectBoardDescription({
          leadTitle: lead.title,
          prospectName: lead.prospectName,
          notes: lead.notes,
        }),
      });

      const claim = await tx.companyLead.updateMany({
        where: {
          id: lead.id,
          companyId: company.id,
          stage: "WON",
          convertedProjectBoardId: null,
        },
        data: {
          convertedProjectBoardId: board.id,
        },
      });

      if (claim.count !== 1) {
        const currentLead = await tx.companyLead.findFirst({
          where: {
            id: input.leadId,
            companyId: company.id,
          },
          select: {
            stage: true,
            convertedProjectBoardId: true,
          },
        });

        if (!currentLead) {
          throw new ConvertLeadToProjectTransactionError("NOT_FOUND");
        }

        if (currentLead.convertedProjectBoardId) {
          throw new ConvertLeadToProjectTransactionError("ALREADY_CONVERTED");
        }

        throw new ConvertLeadToProjectTransactionError("INVALID_STAGE");
      }

      return {
        data: {
          boardId: board.id,
          companyId: company.id,
          leadId: lead.id,
          workspaceType: WorkspaceType.COMPANY,
        },
      };
    });
  } catch (error) {
    if (error instanceof ConvertLeadToProjectTransactionError) {
      return { error: error.reason };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "ALREADY_CONVERTED" as const };
    }

    throw error;
  }
}
