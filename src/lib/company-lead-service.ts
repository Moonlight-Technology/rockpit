import { BoardRole, CompanyLeadStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createLeadSchema, updateLeadSchema } from "@/lib/validators/company-lead";

const leadBoardDetailInclude = {
  columns: {
    orderBy: { position: "asc" },
  },
  leads: {
    orderBy: { createdAt: "asc" },
  },
  members: {
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  },
} satisfies Prisma.CompanyLeadBoardInclude;

type LeadWorkflowError = "FORBIDDEN" | "NOT_FOUND" | "INVALID_COLUMN" | "USER_NOT_FOUND";

type LeadBoardAccessContext = {
  boardId: string;
  companyId: string;
  ownerId: string;
  isOwner: boolean;
  isMember: boolean;
  columns: Array<{ id: string; title: string; position: number }>;
};

function getStageFromColumnTitle(title: string) {
  switch (title.trim().toLowerCase()) {
    case "new":
      return CompanyLeadStage.NEW;
    case "qualified":
      return CompanyLeadStage.QUALIFIED;
    case "proposal":
      return CompanyLeadStage.PROPOSAL;
    case "negotiation":
      return CompanyLeadStage.NEGOTIATION;
    case "won":
      return CompanyLeadStage.WON;
    case "lost":
      return CompanyLeadStage.LOST;
    default:
      return CompanyLeadStage.NEW;
  }
}

async function getPrimaryLeadBoardContext(
  userId: string,
  companyId: string
): Promise<LeadBoardAccessContext | { error: LeadWorkflowError }> {
  const boards = await prisma.companyLeadBoard.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      companyId: true,
      company: {
        select: { ownerId: true },
      },
      members: {
        where: { userId },
        select: { userId: true },
      },
      columns: {
        select: { id: true, title: true, position: true },
        orderBy: { position: "asc" },
      },
    },
  });

  const primaryBoard = boards[0];
  if (!primaryBoard) {
    return { error: "NOT_FOUND" };
  }

  const isOwner = primaryBoard.company.ownerId === userId;
  const isMember = primaryBoard.members.length > 0;
  if (!isOwner && !isMember) {
    return { error: "FORBIDDEN" };
  }

  return {
    boardId: primaryBoard.id,
    companyId: primaryBoard.companyId,
    ownerId: primaryBoard.company.ownerId,
    isOwner,
    isMember,
    columns: primaryBoard.columns,
  };
}

export async function getLeadBoardForUser(userId: string, companyId: string) {
  const context = await getPrimaryLeadBoardContext(userId, companyId);
  if ("error" in context) {
    return null;
  }

  return prisma.companyLeadBoard.findUnique({
    where: { id: context.boardId },
    include: leadBoardDetailInclude,
  });
}

export async function getLeadBoardAccessForUser(userId: string, companyId: string) {
  const context = await getPrimaryLeadBoardContext(userId, companyId);
  if ("error" in context) {
    return context;
  }

  const board = await prisma.companyLeadBoard.findUnique({
    where: { id: context.boardId },
    include: leadBoardDetailInclude,
  });

  if (!board) {
    return { error: "NOT_FOUND" as const };
  }

  return {
    board,
    isOwner: context.isOwner,
    isMember: context.isMember,
  };
}

export async function createLeadForUser(input: {
  userId: string;
  companyId: string;
  payload: unknown;
}) {
  const parsed = createLeadSchema.parse(input.payload);
  const context = await getPrimaryLeadBoardContext(input.userId, input.companyId);
  if ("error" in context) {
    return context;
  }

  if (!context.isOwner) {
    return { error: "FORBIDDEN" as const };
  }

  const column = context.columns.find((item) => item.id === parsed.columnId);
  if (!column) {
    return { error: "INVALID_COLUMN" as const };
  }

  const lead = await prisma.companyLead.create({
    data: {
      companyId: context.companyId,
      leadBoardId: context.boardId,
      columnId: column.id,
      ownerUserId: input.userId,
      title: parsed.title,
      prospectName: parsed.prospectName,
      estimatedValue: parsed.estimatedValue,
      notes: parsed.notes,
      stage: getStageFromColumnTitle(column.title),
    },
  });

  return { data: lead };
}

export async function updateLeadForUser(input: {
  userId: string;
  companyId: string;
  leadId: string;
  payload: unknown;
}) {
  const parsed = updateLeadSchema.parse(input.payload);
  const context = await getPrimaryLeadBoardContext(input.userId, input.companyId);
  if ("error" in context) {
    return context;
  }

  if (!context.isOwner) {
    return { error: "FORBIDDEN" as const };
  }

  const lead = await prisma.companyLead.findFirst({
    where: {
      id: input.leadId,
      companyId: context.companyId,
      leadBoardId: context.boardId,
    },
    select: { id: true },
  });
  if (!lead) {
    return { error: "NOT_FOUND" as const };
  }

  const data: Prisma.CompanyLeadUpdateInput = {};

  if (parsed.title !== undefined) {
    data.title = parsed.title;
  }
  if (parsed.prospectName !== undefined) {
    data.prospectName = parsed.prospectName;
  }
  if (parsed.estimatedValue !== undefined) {
    data.estimatedValue = parsed.estimatedValue;
  }
  if (parsed.notes !== undefined) {
    data.notes = parsed.notes;
  }
  if (parsed.columnId !== undefined) {
    const column = context.columns.find((item) => item.id === parsed.columnId);
    if (!column) {
      return { error: "INVALID_COLUMN" as const };
    }
    data.column = { connect: { id: column.id } };
    data.stage = getStageFromColumnTitle(column.title);
  }

  const updatedLead = await prisma.companyLead.update({
    where: { id: input.leadId },
    data,
  });

  return { data: updatedLead };
}

export async function addLeadBoardMemberByEmail(input: {
  userId: string;
  companyId: string;
  email: string;
}) {
  const context = await getPrimaryLeadBoardContext(input.userId, input.companyId);
  if ("error" in context) {
    return context;
  }
  if (!context.isOwner) {
    return { error: "FORBIDDEN" as const };
  }

  const targetUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });
  if (!targetUser) {
    return { error: "USER_NOT_FOUND" as const };
  }

  await prisma.companyLeadBoardMember.upsert({
    where: {
      leadBoardId_userId: {
        leadBoardId: context.boardId,
        userId: targetUser.id,
      },
    },
    create: {
      leadBoardId: context.boardId,
      userId: targetUser.id,
      role: BoardRole.MEMBER,
    },
    update: {},
  });

  return { data: targetUser };
}
