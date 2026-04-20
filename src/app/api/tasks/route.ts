import { TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { createStandaloneTaskForUser } from "@/lib/board-service";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { createStandaloneTaskSchema } from "@/lib/validators/board";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const payload = await req.json();
  const parsed = createStandaloneTaskSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError("Invalid task payload.");
  }

  const task = await createStandaloneTaskForUser({
    userId,
    ...parsed.data,
    priority: parsed.data.priority
      ? TaskPriority[parsed.data.priority]
      : TaskPriority.MEDIUM,
  });

  return NextResponse.json({ ok: true, data: task }, { status: 201 });
}
