import { NextResponse } from "next/server";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { saveTaskNetworkPositionForUser } from "@/lib/board-service";
import { updateTaskNetworkPositionSchema } from "@/lib/validators/board";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const parsed = updateTaskNetworkPositionSchema.safeParse(await req.json());
  if (!parsed.success) return validationError("Invalid network position payload.");
  const { id: boardId, taskId } = await params;
  const result = await saveTaskNetworkPositionForUser({ userId, boardId, taskId, ...parsed.data });
  if (!result.ok && result.code === "TASK_NOT_IN_BOARD") return validationError("Task does not belong to this board.");
  if (!result.ok) return notFound("Board not found.");
  return NextResponse.json({ ok: true, data: result.position });
}
