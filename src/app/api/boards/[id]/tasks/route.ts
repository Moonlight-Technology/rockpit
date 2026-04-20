import { TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { addTaskToBoard } from "@/lib/board-service";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { addTaskSchema } from "@/lib/validators/board";

export async function POST(
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
    const parsed = addTaskSchema.safeParse(payload);
    if (!parsed.success) {
      return validationError("Column id and task title are required.");
    }

    const task = await addTaskToBoard({
      userId,
      boardId,
      ...parsed.data,
      priority: parsed.data.priority
        ? TaskPriority[parsed.data.priority]
        : TaskPriority.MEDIUM,
      assigneeId: parsed.data.assigneeId ?? userId,
    });

    if (!task) {
      return notFound("Board or column not found.");
    }

    return NextResponse.json({ ok: true, data: task }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
