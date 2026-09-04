import { NextResponse } from "next/server";
import { replaceTaskDependenciesForUser } from "@/lib/board-service";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { updateTaskDependenciesSchema } from "@/lib/validators/board";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const parsed = updateTaskDependenciesSchema.safeParse(await req.json());
  if (!parsed.success) return validationError("Invalid dependency payload.");

  const { id: taskId } = await params;
  const result = await replaceTaskDependenciesForUser({ userId, taskId, ...parsed.data });
  if (!result.ok) {
    if (result.code === "NOT_FOUND") return notFound(result.message);
    if (result.code === "CYCLE") return NextResponse.json({ ok: false, error: result.message }, { status: 422 });
    return validationError(result.message);
  }
  return NextResponse.json({ ok: true, data: result.task });
}
