import { NextResponse } from "next/server";
import { closeBoardForUser, getBoardDetailForUser, updateBoardForUser } from "@/lib/board-service";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { updateBoardSchema } from "@/lib/validators/board";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { id } = await params;
  const board = await getBoardDetailForUser(userId, id);
  if (!board) {
    return notFound("Board not found.");
  }

  return NextResponse.json({ ok: true, data: board });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { id: boardId } = await params;
  const payload = await req.json();
  const parsed = updateBoardSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError("Invalid board settings payload.");
  }

  const board = await updateBoardForUser({
    userId,
    boardId,
    ...parsed.data,
  });
  if (!board) {
    return notFound("Board not found.");
  }

  return NextResponse.json({ ok: true, data: board });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { id: boardId } = await params;
  const result = await closeBoardForUser({ userId, boardId });
  if (!result) {
    return notFound("Board not found.");
  }
  if ("error" in result && result.error === "OWNER_ONLY") {
    return validationError("Only board owner can close this board.");
  }

  return NextResponse.json({ ok: true });
}
