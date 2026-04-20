import { NextResponse } from "next/server";
import { updateTaskScheduleForUser } from "@/lib/board-service";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { updateTaskScheduleSchema } from "@/lib/validators/board";

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
  const parsed = updateTaskScheduleSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError("Valid due date is required.");
  }

  const task = await updateTaskScheduleForUser({
    userId,
    taskId,
    plannedStartAt: parsed.data.plannedStartAt,
    plannedDurationMinutes: parsed.data.plannedDurationMinutes,
  });

  if (!task) {
    return notFound("Task not found.");
  }

  return NextResponse.json({ ok: true, data: task });
}
