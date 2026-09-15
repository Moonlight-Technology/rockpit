import { NextResponse } from "next/server";
import { getSessionUserId, notFound, unauthorized } from "@/lib/api";
import { listTaskNetworkPositionsForUser, resetTaskNetworkPositionsForUser } from "@/lib/board-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const { id: boardId } = await params;
  const positions = await listTaskNetworkPositionsForUser({ userId, boardId });
  if (!positions) return notFound("Board not found.");
  return NextResponse.json({ ok: true, data: positions });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const { id: boardId } = await params;
  if (!(await resetTaskNetworkPositionsForUser({ userId, boardId }))) return notFound("Board not found.");
  return NextResponse.json({ ok: true });
}
