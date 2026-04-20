import { NextResponse } from "next/server";
import { deleteTaskForUser, updateTaskForUser } from "@/lib/board-service";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { updateTaskSchema } from "@/lib/validators/board";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { id: taskId } = await params;
  const payload = await req.json();
  const parsed = updateTaskSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError("Invalid task payload.");
  }

  const task = await updateTaskForUser({
    userId,
    taskId,
    ...parsed.data,
  });
  if (!task) {
    return notFound("Task not found or assignee is not a board member.");
  }

  return NextResponse.json({ ok: true, data: task });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { id: taskId } = await params;
  const result = await deleteTaskForUser({ userId, taskId });
  if (!result) {
    return notFound("Task not found.");
  }

  return NextResponse.json({ ok: true });
}
