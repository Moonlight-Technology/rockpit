import { NextResponse } from "next/server";
import { addColumnToBoard, renameBoardColumn, reorderBoardColumn } from "@/lib/board-service";
import {
  getSessionUserId,
  notFound,
  unauthorized,
  validationError,
} from "@/lib/api";
import { addColumnSchema, renameColumnSchema, reorderColumnSchema } from "@/lib/validators/board";

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
    const mode = payload?.mode;

    if (mode === "add") {
      const parsed = addColumnSchema.safeParse(payload);
      if (!parsed.success) {
        return validationError("Column title is required.");
      }

      const column = await addColumnToBoard({
        userId,
        boardId,
        title: parsed.data.title,
      });

      if (!column) {
        return notFound("Board not found.");
      }

      return NextResponse.json({ ok: true, data: column });
    }

    if (mode === "rename") {
      const parsed = renameColumnSchema.safeParse(payload);
      if (!parsed.success) {
        return validationError("Column id and title are required.");
      }

      const column = await renameBoardColumn({
        userId,
        boardId,
        columnId: parsed.data.columnId,
        title: parsed.data.title,
      });

      if (!column) {
        return notFound("Board or column not found.");
      }

      return NextResponse.json({ ok: true, data: column });
    }

    if (mode === "reorder") {
      const parsed = reorderColumnSchema.safeParse(payload);
      if (!parsed.success) {
        return validationError("Column id and target index are required.");
      }

      const result = await reorderBoardColumn({
        userId,
        boardId,
        columnId: parsed.data.columnId,
        toIndex: parsed.data.toIndex,
      });

      if (!result) {
        return notFound("Board or column not found.");
      }

      return NextResponse.json({ ok: true, data: result });
    }

    return validationError("Invalid mode. Use add, rename, or reorder.");
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
