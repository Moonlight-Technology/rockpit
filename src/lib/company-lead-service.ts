import { BoardRole, CompanyLeadStage, Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";
import { createLeadSchema, updateLeadSchema } from "./validators/company-lead.ts";

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

type LeadWorkflowError =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_COLUMN"
  | "INVALID_CLIENT"
  | "USER_NOT_FOUND";

type LeadDeps = {
  prisma: {
    companyLeadBoard: {
      findMany: (args: unknown) => Promise<
        Array<{
          id: string;
          companyId: string;
          company: { ownerId: string };
          members: Array<{ userId: string }>;
          columns: Array<{ id: string; title: string; position: number }>;
        }>
      >;
      findUnique?: typeof prisma.companyLeadBoard.findUnique;
    };
    companyClient: {
      findFirst: (args: unknown) => Promise<{ id: string; name: string } | null>;
    };
    companyLead: {
      create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    };
  };
};

const leadCreateDeps: LeadDeps = {
  prisma: prisma as unknown as LeadDeps["prisma"],
};

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

export function findStageColumn(
  columns: Array<{ id: string; title: string }>,
  stage: CompanyLeadStage
): { id: string; title: string } | null {
  return (
    columns.find((column) => getStageFromColumnTitle(column.title) === stage) ?? null
  );
}

async function getPrimaryLeadBoardContext(
  userId: string,
  companyId: string
): Promise<LeadBoardAccessContext | { error: LeadWorkflowError }> {
  return getPrimaryLeadBoardContextWithDependencies(userId, companyId, {
    prisma: {
      companyLeadBoard: prisma.companyLeadBoard as unknown as LeadDeps["prisma"]["companyLeadBoard"],
      companyClient: prisma.companyClient as unknown as LeadDeps["prisma"]["companyClient"],
      companyLead: prisma.companyLead as unknown as LeadDeps["prisma"]["companyLead"],
    },
  });
}

async function getPrimaryLeadBoardContextWithDependencies(
  userId: string,
  companyId: string,
  deps: Pick<LeadDeps, "prisma">
): Promise<LeadBoardAccessContext | { error: LeadWorkflowError }> {
  const boards = await deps.prisma.companyLeadBoard.findMany({
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
  return createLeadWithDependencies(input, leadCreateDeps);
}

export async function createLeadWithDependencies(
  input: {
    userId: string;
    companyId: string;
    payload: unknown;
  },
  deps: LeadDeps = leadCreateDeps
) {
  const parsed = createLeadSchema.parse(input.payload);
  const context = await getPrimaryLeadBoardContextWithDependencies(
    input.userId,
    input.companyId,
    deps
  );
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

  const client = await deps.prisma.companyClient.findFirst({
    where: { id: parsed.clientId, companyId: context.companyId },
    select: { id: true, name: true },
  });
  if (!client) {
    return { error: "INVALID_CLIENT" as const };
  }

  const lead = await deps.prisma.companyLead.create({
    data: {
      companyId: context.companyId,
      leadBoardId: context.boardId,
      columnId: column.id,
      ownerUserId: input.userId,
      title: parsed.title,
      clientId: client.id,
      prospectName: client.name,
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
