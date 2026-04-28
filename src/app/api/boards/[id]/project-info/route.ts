import { NextResponse } from "next/server";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { getBoardProjectInfoForUser, saveBoardProjectInfoForUser } from "@/lib/board-service";
import { updateBoardProjectInfoSchema } from "@/lib/validators/board";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id: boardId } = await params;
  const projectInfo = await getBoardProjectInfoForUser(userId, boardId);
  if (!projectInfo) {
    return notFound("Board not found.");
  }

  return NextResponse.json({ ok: true, data: projectInfo });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id: boardId } = await params;
  const payload = await req.json().catch(() => null);
  const parsed = updateBoardProjectInfoSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError("Invalid project info payload.");
  }

  const result = await saveBoardProjectInfoForUser({
    userId,
    boardId,
    notes: parsed.data.notes,
    resources: parsed.data.resources,
  });
  if (!result) {
    return notFound("Board not found.");
  }

  return NextResponse.json({ ok: true, data: result });
}
