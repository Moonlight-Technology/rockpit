import { NextResponse } from "next/server";
import { listPlannerTasksForUser } from "@/lib/board-service";
import { getSessionUserId, unauthorized } from "@/lib/api";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const tasks = await listPlannerTasksForUser(userId);
  return NextResponse.json({ ok: true, data: tasks });
}
