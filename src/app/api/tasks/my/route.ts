import { NextResponse } from "next/server";
import { listAssignedTasksForUser } from "@/lib/board-service";
import { getSessionUserId, unauthorized } from "@/lib/api";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const tasks = await listAssignedTasksForUser(userId);
  return NextResponse.json({ ok: true, data: tasks });
}
