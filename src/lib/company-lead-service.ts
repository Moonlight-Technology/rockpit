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

async function getAccessibleLeadBoardReference(userId: string, companyId: string) {
  return prisma.companyLeadBoard.findFirst({
    where: {
      companyId,
      OR: [{ company: { ownerId: userId } }, { members: { some: { userId } } }],
    },
    select: {
      id: true,
      company: {
        select: { ownerId: true },
      },
      columns: {
        select: { id: true, title: true, position: true },
        orderBy: { position: "asc" },
      },
    },
  });
}

export async function getLeadBoardForUser(userId: string, companyId: string) {
  return prisma.companyLeadBoard.findFirst({
    where: {
      companyId,
      OR: [{ company: { ownerId: userId } }, { members: { some: { userId } } }],
    },
    include: leadBoardDetailInclude,
  });
}

export async function createLeadForUser(input: {
  userId: string;
  companyId: string;
  payload: unknown;
}) {
  const parsed = createLeadSchema.parse(input.payload);
  const leadBoard = await getAccessibleLeadBoardReference(input.userId, input.companyId);
  if (!leadBoard) {
    return null;
  }

  const column = leadBoard.columns.find((item) => item.id === parsed.columnId);
  if (!column) {
    return null;
  }

  return prisma.companyLead.create({
    data: {
      companyId: input.companyId,
      leadBoardId: leadBoard.id,
      columnId: column.id,
      ownerUserId: input.userId,
      title: parsed.title,
      prospectName: parsed.prospectName,
      estimatedValue: parsed.estimatedValue,
      notes: parsed.notes,
      stage: getStageFromColumnTitle(column.title),
    },
  });
}

export async function updateLeadForUser(input: {
  userId: string;
  companyId: string;
  leadId: string;
  payload: unknown;
}) {
  const parsed = updateLeadSchema.parse(input.payload);
  const lead = await prisma.companyLead.findFirst({
    where: {
      id: input.leadId,
      companyId: input.companyId,
      leadBoard: {
        OR: [{ company: { ownerId: input.userId } }, { members: { some: { userId: input.userId } } }],
      },
    },
    include: {
      leadBoard: {
        select: {
          id: true,
          columns: {
            select: { id: true, title: true },
          },
        },
      },
    },
  });
  if (!lead) {
    return null;
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
    const column = lead.leadBoard.columns.find((item) => item.id === parsed.columnId);
    if (!column) {
      return null;
    }
    data.column = { connect: { id: column.id } };
    data.stage = getStageFromColumnTitle(column.title);
  }

  return prisma.companyLead.update({
    where: { id: input.leadId },
    data,
  });
}

export async function addLeadBoardMemberByEmail(input: {
  userId: string;
  companyId: string;
  email: string;
}) {
  const leadBoard = await getAccessibleLeadBoardReference(input.userId, input.companyId);
  if (!leadBoard) {
    return null;
  }
  if (leadBoard.company.ownerId !== input.userId) {
    return { error: "OWNER_ONLY" as const };
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
        leadBoardId: leadBoard.id,
        userId: targetUser.id,
      },
    },
    create: {
      leadBoardId: leadBoard.id,
      userId: targetUser.id,
      role: BoardRole.MEMBER,
    },
    update: {},
  });

  return targetUser;
}
