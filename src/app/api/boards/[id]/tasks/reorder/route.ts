import { NextResponse } from "next/server";
import { reorderTask } from "@/lib/board-service";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { reorderTaskSchema } from "@/lib/validators/board";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { id: boardId } = await params;

  try {
    const payload = await req.json();
    const parsed = reorderTaskSchema.safeParse(payload);
    if (!parsed.success) {
      return validationError("Task id, destination column, and index are required.");
    }

    const result = await reorderTask({
      userId,
      boardId,
      ...parsed.data,
    });
    if (!result) {
      return notFound("Task or column not found.");
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
