import { z } from "zod";

const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
const statusEnum = z.enum(["TODO", "DONE"]);
const timerMetadataSchema = {
  trackedByTimer: z.boolean().optional(),
  actualDurationMinutes: z.number().int().min(1).max(24 * 60).optional().nullable(),
};

export const createBoardSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(240),
  theme: z.string().trim().min(2).max(40),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const renameColumnSchema = z.object({
  columnId: z.string().cuid(),
  title: z.string().trim().min(1).max(120),
});

export const addColumnSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export const reorderColumnSchema = z.object({
  columnId: z.string().cuid(),
  toIndex: z.number().int().min(0),
});

export const addTaskSchema = z.object({
  columnId: z.string().cuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  assigneeIds: z.array(z.string().cuid()).max(20).optional(),
  ...timerMetadataSchema,
});

export const reorderTaskSchema = z.object({
  taskId: z.string().cuid(),
  toColumnId: z.string().cuid(),
  toIndex: z.number().int().min(0),
});

export const updateTaskStatusSchema = z.object({
  status: statusEnum,
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: priorityEnum,
  boardId: z.string().cuid().optional().nullable(),
  columnId: z.string().cuid().optional().nullable(),
  assigneeId: z.string().cuid().optional().nullable(),
  assigneeIds: z.array(z.string().cuid()).max(20).optional(),
});

export const updateTaskScheduleSchema = z.object({
  plannedStartAt: z.string().datetime().nullable(),
  plannedDurationMinutes: z.number().int().min(30).max(12 * 60).nullable().optional(),
});

export const updateTaskDependenciesSchema = z.object({
  dependsOnTaskIds: z.array(z.string().cuid()).max(100).superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "Dependency ids must be unique." });
    }
  }),
});

export const createStandaloneTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: priorityEnum.optional(),
  ...timerMetadataSchema,
});

export const updateBoardSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(240),
  theme: z.string().trim().min(2).max(40),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const addMemberByEmailSchema = z.object({
  email: z.string().trim().email(),
});

export const updateBoardProjectInfoSchema = z.object({
  notes: z.string().max(20000).default(""),
  resources: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        key: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(5000),
      })
    )
    .max(100)
    .default([]),
});
