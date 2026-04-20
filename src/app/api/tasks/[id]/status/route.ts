import { NextResponse } from "next/server";
import { updateTaskStatusForUser } from "@/lib/board-service";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { updateTaskStatusSchema } from "@/lib/validators/board";

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
  const parsed = updateTaskStatusSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError("Valid task status is required.");
  }

  const task = await updateTaskStatusForUser({
    userId,
    taskId,
    status: parsed.data.status,
  });
  if (!task) {
    return notFound("Task not found.");
  }

  return NextResponse.json({ ok: true, data: task });
}
