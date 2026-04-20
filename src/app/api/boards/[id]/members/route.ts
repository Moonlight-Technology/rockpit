import { NextResponse } from "next/server";
import { addBoardMemberByEmail } from "@/lib/board-service";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { addMemberByEmailSchema } from "@/lib/validators/board";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { id: boardId } = await params;
  const payload = await req.json();
  const parsed = addMemberByEmailSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError("Valid email is required.");
  }

  const result = await addBoardMemberByEmail({
    userId,
    boardId,
    email: parsed.data.email,
  });

  if (!result) {
    return notFound("Board not found.");
  }

  if ("error" in result) {
    return notFound("User with this email is not registered.");
  }

  return NextResponse.json({ ok: true, data: result }, { status: 201 });
}
