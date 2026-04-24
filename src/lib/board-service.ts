import { BoardRole, Prisma, TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const defaultColumns = ["To Do", "In Progress", "Done"];
const DONE_COLUMN_TITLE = "done";

function isDoneColumnTitle(title: string) {
  return title.trim().toLowerCase() === DONE_COLUMN_TITLE;
}

function normalizeAssigneeIds(assigneeIds?: (string | null | undefined)[]) {
  return Array.from(new Set((assigneeIds ?? []).filter(Boolean) as string[])).slice(0, 20);
}

const boardDetailInclude = {
  members: {
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  },
  columns: {
    orderBy: { position: "asc" },
    include: {
      tasks: {
        orderBy: { position: "asc" },
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignees: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.BoardInclude;

export async function listBoardsForUser(
  userId: string,
  options?: { includeClosed?: boolean }
) {
  const includeClosed = options?.includeClosed === true;
  const boards = await prisma.board.findMany({
    where: {
      ...(includeClosed ? {} : { closedAt: null }),
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: {
      _count: { select: { columns: true } },
      columns: {
        select: {
          title: true,
          tasks: {
            select: {
              status: true,
            },
          },
        },
      },
      members: {
        where: { userId },
        select: { isPinned: true, pinnedAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return boards.map((board) => ({
    ...board,
    isPinnedForUser: board.members[0]?.isPinned ?? false,
    pinnedAtForUser: board.members[0]?.pinnedAt ?? null,
  }));
}

export async function createBoardForUser(input: {
  userId: string;
  title: string;
  description: string;
  theme: string;
  tags?: string[];
  dueDate?: string | null;
}) {
  const normalizedTags = Array.from(
    new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))
  ).slice(0, 10);

  return prisma.$transaction(async (tx) => {
    const board = await tx.board.create({
      data: {
        title: input.title,
        description: input.description,
        theme: input.theme,
        tags: normalizedTags,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        ownerId: input.userId,
      },
    });

    await tx.boardMember.create({
      data: {
        boardId: board.id,
        userId: input.userId,
        role: BoardRole.OWNER,
      },
    });

    await tx.boardColumn.createMany({
      data: defaultColumns.map((title, idx) => ({
        boardId: board.id,
        title,
        position: idx,
      })),
    });

    return board;
  });
}

export async function updateBoardForUser(input: {
  userId: string;
  boardId: string;
  title: string;
  description: string;
  theme: string;
  tags?: string[];
  dueDate?: string | null;
}) {
  const access = await canAccessBoard(input.userId, input.boardId);
  if (!access) return null;

  const normalizedTags = Array.from(
    new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))
  ).slice(0, 10);

  return prisma.board.update({
    where: { id: input.boardId },
    data: {
      title: input.title,
      description: input.description,
      theme: input.theme,
      tags: normalizedTags,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
  });
}

export async function addBoardMemberByEmail(input: {
  userId: string;
  boardId: string;
  email: string;
}) {
  const board = await prisma.board.findUnique({
    where: { id: input.boardId },
    select: { id: true, ownerId: true },
  });
  if (!board) return null;
  if (board.ownerId !== input.userId) {
    return { error: "OWNER_ONLY" as const };
  }

  const targetUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });
  if (!targetUser) return { error: "USER_NOT_FOUND" as const };

  await prisma.boardMember.upsert({
    where: {
      boardId_userId: {
        boardId: input.boardId,
        userId: targetUser.id,
      },
    },
    create: {
      boardId: input.boardId,
      userId: targetUser.id,
      role: BoardRole.MEMBER,
    },
    update: {},
  });

  return targetUser;
}

export async function canAccessBoard(userId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      closedAt: null,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  });
  return Boolean(board);
}

export async function getBoardDetailForUser(userId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      closedAt: null,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: boardDetailInclude,
  });
  return board;
}

export async function closeBoardForUser(input: { userId: string; boardId: string }) {
  const board = await prisma.board.findUnique({
    where: { id: input.boardId },
    select: { id: true, ownerId: true, closedAt: true },
  });
  if (!board || board.closedAt) return null;
  if (board.ownerId !== input.userId) return { error: "OWNER_ONLY" as const };

  return prisma.board.update({
    where: { id: input.boardId },
    data: { closedAt: new Date() },
  });
}

export async function setBoardPinForUser(input: {
  userId: string;
  boardId: string;
  pin: boolean;
  replaceBoardId?: string | null;
}) {
  const targetMembership = await prisma.boardMember.findFirst({
    where: {
      boardId: input.boardId,
      userId: input.userId,
      board: { closedAt: null },
    },
    select: { id: true, isPinned: true, boardId: true },
  });
  if (!targetMembership) return { error: "NOT_FOUND" as const };

  if (!input.pin) {
    if (!targetMembership.isPinned) return { ok: true as const };
    await prisma.boardMember.update({
      where: { id: targetMembership.id },
      data: { isPinned: false, pinnedAt: null },
    });
    return { ok: true as const };
  }

  if (targetMembership.isPinned) return { ok: true as const };

  const pinnedMemberships = await prisma.boardMember.findMany({
    where: {
      userId: input.userId,
      isPinned: true,
      board: { closedAt: null },
    },
    select: { id: true, boardId: true, pinnedAt: true, board: { select: { id: true, title: true } } },
    orderBy: [{ pinnedAt: "asc" }, { updatedAt: "asc" }],
  });

  const maxPinnedBoards = 2;
  if (pinnedMemberships.length >= maxPinnedBoards) {
    const replaceBoardId = input.replaceBoardId ?? null;
    if (!replaceBoardId) {
      return {
        error: "PIN_LIMIT" as const,
        pinnedBoards: pinnedMemberships.map((item) => ({
          id: item.board.id,
          title: item.board.title,
        })),
      };
    }

    const replaceMembership = pinnedMemberships.find((item) => item.boardId === replaceBoardId);
    if (!replaceMembership) {
      return {
        error: "REPLACE_NOT_PINNED" as const,
        pinnedBoards: pinnedMemberships.map((item) => ({
          id: item.board.id,
          title: item.board.title,
        })),
      };
    }

    await prisma.$transaction([
      prisma.boardMember.update({
        where: { id: replaceMembership.id },
        data: { isPinned: false, pinnedAt: null },
      }),
      prisma.boardMember.update({
        where: { id: targetMembership.id },
        data: { isPinned: true, pinnedAt: new Date() },
      }),
    ]);
    return { ok: true as const };
  }

  await prisma.boardMember.update({
    where: { id: targetMembership.id },
    data: { isPinned: true, pinnedAt: new Date() },
  });
  return { ok: true as const };
}

export async function addColumnToBoard(input: {
  userId: string;
  boardId: string;
  title: string;
}) {
  const access = await canAccessBoard(input.userId, input.boardId);
  if (!access) return null;

  return prisma.$transaction(async (tx) => {
    const doneColumn = await tx.boardColumn.findFirst({
      where: { boardId: input.boardId, title: { equals: DONE_COLUMN_TITLE, mode: "insensitive" } },
      orderBy: { position: "asc" },
    });

    if (!doneColumn) {
      const lastColumn = await tx.boardColumn.findFirst({
        where: { boardId: input.boardId },
        orderBy: { position: "desc" },
      });
      const position = lastColumn ? lastColumn.position + 1 : 0;
      return tx.boardColumn.create({
        data: {
          boardId: input.boardId,
          title: input.title,
          position,
        },
      });
    }

    await tx.boardColumn.updateMany({
      where: {
        boardId: input.boardId,
        position: { gte: doneColumn.position },
      },
      data: {
        position: { increment: 1 },
      },
    });

    return tx.boardColumn.create({
      data: {
        boardId: input.boardId,
        title: input.title,
        position: doneColumn.position,
      },
    });
  });
}

export async function renameBoardColumn(input: {
  userId: string;
  boardId: string;
  columnId: string;
  title: string;
}) {
  const access = await canAccessBoard(input.userId, input.boardId);
  if (!access) return null;

  const column = await prisma.boardColumn.findFirst({
    where: { id: input.columnId, boardId: input.boardId },
    select: { id: true, title: true },
  });
  if (!column) return null;
  if (isDoneColumnTitle(column.title)) {
    return column;
  }

  return prisma.boardColumn.update({
    where: { id: input.columnId },
    data: { title: input.title },
  });
}

export async function reorderBoardColumn(input: {
  userId: string;
  boardId: string;
  columnId: string;
  toIndex: number;
}) {
  const access = await canAccessBoard(input.userId, input.boardId);
  if (!access) return null;

  return prisma.$transaction(async (tx) => {
    const columns = await tx.boardColumn.findMany({
      where: { boardId: input.boardId },
      orderBy: { position: "asc" },
    });
    const moving = columns.find((column) => column.id === input.columnId);
    if (!moving) return null;
    if (isDoneColumnTitle(moving.title)) {
      return { ok: true };
    }

    const movable = columns.filter((column) => !isDoneColumnTitle(column.title));
    const remaining = movable.filter((column) => column.id !== input.columnId);
    const safeIndex = Math.max(0, Math.min(input.toIndex, remaining.length));
    const reorderedMovable = [...remaining];
    reorderedMovable.splice(safeIndex, 0, moving);

    const doneColumns = columns.filter((column) => isDoneColumnTitle(column.title));
    const finalColumns: typeof columns = [...reorderedMovable, ...doneColumns];

    for (let i = 0; i < finalColumns.length; i += 1) {
      await tx.boardColumn.update({
        where: { id: finalColumns[i].id },
        data: { position: i },
      });
    }

    return { ok: true };
  });
}

export async function addTaskToBoard(input: {
  userId: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  assigneeId?: string | null;
  assigneeIds?: string[];
  status?: "TODO" | "DONE";
}) {
  const access = await canAccessBoard(input.userId, input.boardId);
  if (!access) return null;

  const column = await prisma.boardColumn.findFirst({
    where: { id: input.columnId, boardId: input.boardId },
    select: { id: true, title: true },
  });
  if (!column) return null;

  const assigneeIds = normalizeAssigneeIds(
    input.assigneeIds && input.assigneeIds.length > 0
      ? input.assigneeIds
      : input.assigneeId
        ? [input.assigneeId]
        : []
  );

  if (assigneeIds.length > 0) {
    const members = await prisma.boardMember.findMany({
      where: {
        boardId: input.boardId,
        userId: { in: assigneeIds },
      },
      select: { userId: true },
    });
    if (members.length !== assigneeIds.length) {
      return null;
    }
  }

  const lastTask = await prisma.task.findFirst({
    where: { boardId: input.boardId, columnId: input.columnId },
    orderBy: { position: "desc" },
  });

  return prisma.task.create({
    data: {
      boardId: input.boardId,
      columnId: input.columnId,
      createdById: input.userId,
      title: input.title,
      description: input.description ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: input.priority ?? TaskPriority.MEDIUM,
      status: input.status ?? (isDoneColumnTitle(column.title) ? "DONE" : "TODO"),
      completedAt:
        (input.status ?? (isDoneColumnTitle(column.title) ? "DONE" : "TODO")) === "DONE"
          ? new Date()
          : null,
      assigneeId: assigneeIds[0] ?? null,
      assignees: assigneeIds.length
        ? {
            createMany: {
              data: assigneeIds.map((userId) => ({ userId })),
              skipDuplicates: true,
            },
          }
        : undefined,
      position: lastTask ? lastTask.position + 1 : 0,
    },
  });
}

export async function createStandaloneTaskForUser(input: {
  userId: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
}) {
  return prisma.task.create({
    data: {
      boardId: null,
      columnId: null,
      createdById: input.userId,
      assigneeId: input.userId,
      assignees: {
        create: {
          userId: input.userId,
        },
      },
      title: input.title,
      description: input.description ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: input.priority ?? TaskPriority.MEDIUM,
      status: "TODO",
      position: 0,
    },
    include: {
      board: { select: { id: true, title: true } },
      column: { select: { id: true, title: true } },
    },
  });
}

export async function listAssignedTasksForUser(userId: string) {
  return prisma.task.findMany({
    where: {
      AND: [
        { OR: [{ assigneeId: userId }, { assignees: { some: { userId } } }] },
        { OR: [
        {
          board: {
            closedAt: null,
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
          },
        },
        { boardId: null },
      ]},
      ],
    },
    include: {
      board: {
        select: { id: true, title: true },
      },
      column: {
        select: { id: true, title: true },
      },
      assignee: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: 30,
  });
}

export async function listAllTasksForUser(userId: string) {
  return prisma.task.findMany({
    where: {
      OR: [
        {
          board: {
            closedAt: null,
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
          },
        },
        {
          boardId: null,
          OR: [
            { assigneeId: userId },
            { assignees: { some: { userId } } },
            { createdById: userId },
          ],
        },
      ],
    },
    include: {
      board: {
        select: { id: true, title: true, theme: true },
      },
      column: {
        select: { id: true, title: true },
      },
      assignee: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });
}

export async function updateTaskStatusForUser(input: {
  userId: string;
  taskId: string;
  status: "TODO" | "DONE";
}) {
  const task = await prisma.task.findFirst({
    where: {
      id: input.taskId,
      OR: [
        {
          board: {
            closedAt: null,
            OR: [{ ownerId: input.userId }, { members: { some: { userId: input.userId } } }],
          },
        },
        {
          boardId: null,
          OR: [{ assigneeId: input.userId }, { assignees: { some: { userId: input.userId } } }],
        },
      ],
    },
    select: { id: true, boardId: true, columnId: true },
  });
  if (!task) return null;

  if (!task.boardId) {
    return prisma.task.update({
      where: { id: input.taskId },
      data: {
        status: input.status,
        completedAt: input.status === "DONE" ? new Date() : null,
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    const doneColumn = await tx.boardColumn.findFirst({
      where: {
        boardId: task.boardId as string,
        title: { equals: "Done", mode: "insensitive" },
      },
      orderBy: { position: "asc" },
      select: { id: true, title: true },
    });

    const fallbackColumn = await tx.boardColumn.findFirst({
      where: {
        boardId: task.boardId as string,
        NOT: { title: { equals: "Done", mode: "insensitive" } },
      },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    let nextColumnId = task.columnId;
    let nextPosition = undefined as number | undefined;

    if (input.status === "DONE" && doneColumn && task.columnId !== doneColumn.id) {
      const lastInDone = await tx.task.findFirst({
        where: { boardId: task.boardId as string, columnId: doneColumn.id },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      nextColumnId = doneColumn.id;
      nextPosition = lastInDone ? lastInDone.position + 1 : 0;
    }

    if (
      input.status === "TODO" &&
      doneColumn &&
      task.columnId === doneColumn.id &&
      fallbackColumn
    ) {
      const lastInFallback = await tx.task.findFirst({
        where: { boardId: task.boardId as string, columnId: fallbackColumn.id },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      nextColumnId = fallbackColumn.id;
      nextPosition = lastInFallback ? lastInFallback.position + 1 : 0;
    }

    return tx.task.update({
      where: { id: input.taskId },
      data: {
        status: input.status,
        completedAt: input.status === "DONE" ? new Date() : null,
        columnId: nextColumnId,
        ...(typeof nextPosition === "number" ? { position: nextPosition } : {}),
      },
    });
  });
}

export async function updateTaskForUser(input: {
  userId: string;
  taskId: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  boardId?: string | null;
  columnId?: string | null;
  assigneeId?: string | null;
  assigneeIds?: string[];
}) {
  const task = await prisma.task.findFirst({
    where: {
      id: input.taskId,
      OR: [
        {
          board: {
            closedAt: null,
            OR: [{ ownerId: input.userId }, { members: { some: { userId: input.userId } } }],
          },
        },
        {
          boardId: null,
          OR: [{ assigneeId: input.userId }, { assignees: { some: { userId: input.userId } } }],
        },
      ],
    },
    select: { id: true, boardId: true, columnId: true, status: true, position: true },
  });
  if (!task) return null;

  const nextBoardId =
    input.boardId !== undefined
      ? input.boardId
      : task.boardId;

  if (nextBoardId) {
    const access = await canAccessBoard(input.userId, nextBoardId);
    if (!access) return null;
  }

  let nextColumnId: string | null = null;
  let nextColumnTitle: string | null = null;

  if (nextBoardId) {
    const requestedColumnId =
      input.columnId !== undefined
        ? input.columnId
        : task.boardId === nextBoardId
          ? task.columnId
          : null;

    if (requestedColumnId) {
      const targetColumn = await prisma.boardColumn.findFirst({
        where: { id: requestedColumnId, boardId: nextBoardId },
        select: { id: true, title: true },
      });
      if (!targetColumn) return null;
      nextColumnId = targetColumn.id;
      nextColumnTitle = targetColumn.title;
    } else {
      const fallbackColumn =
        (await prisma.boardColumn.findFirst({
          where: { boardId: nextBoardId, NOT: { title: { equals: "Done", mode: "insensitive" } } },
          orderBy: { position: "asc" },
          select: { id: true, title: true },
        })) ??
        (await prisma.boardColumn.findFirst({
          where: { boardId: nextBoardId },
          orderBy: { position: "asc" },
          select: { id: true, title: true },
        }));

      if (!fallbackColumn) return null;
      nextColumnId = fallbackColumn.id;
      nextColumnTitle = fallbackColumn.title;
    }
  }

  const normalizedAssigneeIds = normalizeAssigneeIds(
    input.assigneeIds && input.assigneeIds.length > 0
      ? input.assigneeIds
      : input.assigneeId
        ? [input.assigneeId]
        : []
  );

  if (nextBoardId && normalizedAssigneeIds.length > 0) {
    const members = await prisma.boardMember.findMany({
      where: {
        boardId: nextBoardId,
        userId: { in: normalizedAssigneeIds },
      },
      select: { userId: true },
    });
    if (members.length !== normalizedAssigneeIds.length) return null;
  }

  const assignmentIds =
    nextBoardId
      ? normalizedAssigneeIds
      : [input.userId];

  return prisma.$transaction(async (tx) => {
    await tx.taskAssignment.deleteMany({ where: { taskId: input.taskId } });

    if (assignmentIds.length > 0) {
      await tx.taskAssignment.createMany({
        data: assignmentIds.map((userId) => ({ taskId: input.taskId, userId })),
        skipDuplicates: true,
      });
    }

    const isColumnChanged = task.boardId !== nextBoardId || task.columnId !== nextColumnId;
    let nextPosition = task.position;
    if (nextBoardId && nextColumnId && isColumnChanged) {
      const lastTask = await tx.task.findFirst({
        where: { boardId: nextBoardId, columnId: nextColumnId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      nextPosition = lastTask ? lastTask.position + 1 : 0;
    }

    const nextStatus =
      nextBoardId && nextColumnTitle
        ? (isDoneColumnTitle(nextColumnTitle) ? "DONE" : "TODO")
        : task.status;

    return tx.task.update({
      where: { id: input.taskId },
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priority: input.priority,
        boardId: nextBoardId,
        columnId: nextColumnId,
        position: nextPosition,
        status: nextStatus,
        completedAt: nextStatus === "DONE" ? new Date() : null,
        assigneeId: assignmentIds[0] ?? null,
      },
    });
  });
}

export async function updateTaskScheduleForUser(input: {
  userId: string;
  taskId: string;
  plannedStartAt: string | null;
  plannedDurationMinutes?: number | null;
}) {
  const task = await prisma.task.findFirst({
    where: {
      id: input.taskId,
      OR: [
        {
          board: {
            closedAt: null,
            OR: [{ ownerId: input.userId }, { members: { some: { userId: input.userId } } }],
          },
        },
        {
          boardId: null,
          OR: [{ assigneeId: input.userId }, { assignees: { some: { userId: input.userId } } }],
        },
      ],
    },
    select: { id: true },
  });
  if (!task) return null;

  return prisma.task.update({
    where: { id: input.taskId },
    data: {
      plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : null,
      plannedDurationMinutes:
        typeof input.plannedDurationMinutes === "number"
          ? input.plannedDurationMinutes
          : input.plannedStartAt
            ? 60
            : null,
    },
  });
}

export async function deleteTaskForUser(input: { userId: string; taskId: string }) {
  const task = await prisma.task.findFirst({
    where: {
      id: input.taskId,
      OR: [
        {
          board: {
            closedAt: null,
            OR: [{ ownerId: input.userId }, { members: { some: { userId: input.userId } } }],
          },
        },
        {
          boardId: null,
          OR: [{ assigneeId: input.userId }, { assignees: { some: { userId: input.userId } } }],
        },
      ],
    },
    select: { id: true },
  });
  if (!task) return null;

  await prisma.task.delete({
    where: { id: input.taskId },
  });

  return { ok: true };
}

export async function reorderTask(input: {
  userId: string;
  boardId: string;
  taskId: string;
  toColumnId: string;
  toIndex: number;
}) {
  const access = await canAccessBoard(input.userId, input.boardId);
  if (!access) return null;

  return prisma.$transaction(async (tx) => {
    const movingTask = await tx.task.findFirst({
      where: { id: input.taskId, boardId: input.boardId },
    });
    if (!movingTask) return null;

    const destinationColumn = await tx.boardColumn.findFirst({
      where: { id: input.toColumnId, boardId: input.boardId },
      select: { id: true, title: true },
    });
    if (!destinationColumn) return null;

    const sourceTasks = await tx.task.findMany({
      where: { boardId: input.boardId, columnId: movingTask.columnId },
      orderBy: { position: "asc" },
    });
    const destTasks = await tx.task.findMany({
      where: { boardId: input.boardId, columnId: input.toColumnId },
      orderBy: { position: "asc" },
    });

    const remainingSource = sourceTasks.filter((task) => task.id !== input.taskId);
    const insertingTask = { ...movingTask, columnId: input.toColumnId };

    const sameColumn = movingTask.columnId === input.toColumnId;
    const baseDest = sameColumn ? remainingSource : destTasks;
    const safeIndex = Math.max(0, Math.min(input.toIndex, baseDest.length));

    const nextDest = [...baseDest];
    nextDest.splice(safeIndex, 0, insertingTask);

    for (let i = 0; i < remainingSource.length; i += 1) {
      const task = remainingSource[i];
      await tx.task.update({
        where: { id: task.id },
        data: { position: i },
      });
    }

    for (let i = 0; i < nextDest.length; i += 1) {
      const task = nextDest[i];
      await tx.task.update({
        where: { id: task.id },
        data: {
          columnId: input.toColumnId,
          position: i,
          ...(task.id === movingTask.id
            ? {
                status: isDoneColumnTitle(destinationColumn.title) ? "DONE" : "TODO",
                completedAt: isDoneColumnTitle(destinationColumn.title) ? new Date() : null,
              }
            : {}),
        },
      });
    }

    return { ok: true };
  });
}
