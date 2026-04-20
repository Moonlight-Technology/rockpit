import { NextResponse } from "next/server";
import { createBoardForUser, listBoardsForUser } from "@/lib/board-service";
import {
  getSessionUserId,
  unauthorized,
  validationError,
} from "@/lib/api";
import { createBoardSchema } from "@/lib/validators/board";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const boards = await listBoardsForUser(userId);
  return NextResponse.json({ ok: true, data: boards });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  try {
    const payload = await req.json();
    const parsed = createBoardSchema.safeParse(payload);
    if (!parsed.success) {
      return validationError("Board name, description, and theme are required. Tags are optional.");
    }

    const board = await createBoardForUser({
      userId,
      ...parsed.data,
    });

    return NextResponse.json({ ok: true, data: board }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
