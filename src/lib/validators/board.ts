import { z } from "zod";

const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
const statusEnum = z.enum(["TODO", "DONE"]);

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

export const addTaskSchema = z.object({
  columnId: z.string().cuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  assigneeIds: z.array(z.string().cuid()).max(20).optional(),
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
  assigneeId: z.string().cuid().optional().nullable(),
  assigneeIds: z.array(z.string().cuid()).max(20).optional(),
});

export const updateTaskScheduleSchema = z.object({
  plannedStartAt: z.string().datetime().nullable(),
  plannedDurationMinutes: z.number().int().min(30).max(12 * 60).nullable().optional(),
});

export const createStandaloneTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: priorityEnum.optional(),
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
